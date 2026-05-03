import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Platform } from 'react-native';
import {
  showDownloadStarted,
  updateDownloadProgress,
  showDownloadComplete,
  showDownloadFailed,
} from './notificationService';

function formatMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function generateNotifId() {
  return 'download_' + Date.now();
}

export async function startBackgroundDownload(url, fileName, onProgress, meta = null) {
  const notifId = generateNotifId();

  try {
    // Show "starting" notification immediately
    await showDownloadStarted(fileName, notifId);

    const tempPath = FileSystem.cacheDirectory + fileName;

    const downloadResumable = FileSystem.createDownloadResumable(
      url,
      tempPath,
      {},
      async (downloadProgress) => {
        const { totalBytesWritten, totalBytesExpectedToWrite } = downloadProgress;
        
        // Calculate values
        const percent = totalBytesExpectedToWrite > 0 ? Math.round(
          (totalBytesWritten / totalBytesExpectedToWrite) * 100
        ) : 0;
        const downloadedMB = formatMB(totalBytesWritten);
        const totalMB = totalBytesExpectedToWrite > 0 ? formatMB(totalBytesExpectedToWrite) : 0;

        // Update in-app progress bar
        if (onProgress) {
          onProgress({
            percent,
            downloadedMB,
            totalMB,
            bytesWritten: totalBytesWritten,
            bytesTotal: totalBytesExpectedToWrite,
          });
        }

        // Update notification every 2% to avoid spam
        if (percent > 0 && percent % 2 === 0) {
          await updateDownloadProgress(
            notifId,
            fileName,
            percent,
            downloadedMB,
            totalMB
          );
        }
      }
    );

    // Start actual download
    const { uri } = await downloadResumable.downloadAsync();

    // Save to permanent storage without prompting for modify permissions
    let permanentPath = '';
    
    if (Platform.OS === 'android') {
      const publicDir = ReactNativeBlobUtil.fs.dirs.DownloadDir + '/SaveX';
      const isDir = await ReactNativeBlobUtil.fs.isDir(publicDir);
      if (!isDir) {
        await ReactNativeBlobUtil.fs.mkdir(publicDir);
      }
      permanentPath = `${publicDir}/${fileName}`;
      
      const sourcePath = uri.replace('file://', '');
      await ReactNativeBlobUtil.fs.cp(sourcePath, permanentPath);
      
      // Trigger media scanner so it appears in the gallery instantly
      await ReactNativeBlobUtil.fs.scanFile([{ 
        path: permanentPath, 
        mime: fileName.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg' 
      }]);
    } else {
      const permanentDir = FileSystem.documentDirectory + 'SAVEX/';
      await FileSystem.makeDirectoryAsync(permanentDir, { intermediates: true });
      permanentPath = permanentDir + fileName;
      await FileSystem.copyAsync({ from: uri, to: permanentPath });
      
      const asset = await MediaLibrary.createAssetAsync(permanentPath);
      await MediaLibrary.createAlbumAsync('SaveX', asset, false);
    }

    // Clean cache
    await FileSystem.deleteAsync(uri, { idempotent: true });

    // Show success notification
    await showDownloadComplete(notifId, fileName);

    // Save to History
    if (meta) {
      try {
        const { saveDownload } = require('./db');
        const finalSizeMB = downloadResumable.totalBytesExpectedToWrite > 0
          ? formatMB(downloadResumable.totalBytesExpectedToWrite)
          : 0;
        await saveDownload({
          id: Date.now().toString(),
          title: meta.title || 'Unknown Title',
          url: meta.url || url,
          platform: meta.platform || 'unknown',
          format: meta.format || null,
          filesize_mb: finalSizeMB,
          filepath: permanentPath,
          thumbnail: meta.thumbnail || null,
          duration: meta.duration || 0,
        });
      } catch (err) {
        console.warn('Could not save to history:', err);
      }
    }

    return { success: true, localPath: permanentPath };

  } catch (error) {
    console.error('Background download error:', error);
    await showDownloadFailed(notifId, fileName);
    return { success: false, error: error.message };
  }
}
