// SDK 54+: createDownloadResumable lives on the legacy API; main entry throws if used from non-legacy import.
import * as FileSystem from 'expo-file-system/legacy';

import * as MediaLibrary from 'expo-media-library';
import { Alert, Linking } from 'react-native';

export const downloadFile = async (url, fileName, onProgress, meta = null) => {
  try {
    // 1. Check Permissions
    let { status } = await MediaLibrary.getPermissionsAsync();
    if (status !== 'granted') {
      const response = await MediaLibrary.requestPermissionsAsync();
      status = response.status;
    }

    if (status !== 'granted') {
      Alert.alert(
        'Need Your Permission',
        'We need access to your storage to save files. Please allow it in Settings.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return false;
    }

    // 2. Define local URI
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;
    
    // 3. Create Download Resumable for progress tracking
    let fakeProgressInterval = null;
    let currentFakeProgress = 0;

    const downloadResumable = FileSystem.createDownloadResumable(
      url,
      fileUri,
      {},
      (downloadProgress) => {
        const denom = downloadProgress.totalBytesExpectedToWrite || 0;
        if (denom > 0) {
          if (fakeProgressInterval) {
            clearInterval(fakeProgressInterval);
            fakeProgressInterval = null;
          }
          const progress = downloadProgress.totalBytesWritten / denom;
          if (onProgress) onProgress(progress);
        }
      }
    );

    // 4. Start Download with Fake Progress Fallback
    if (onProgress) {
      fakeProgressInterval = setInterval(() => {
        if (currentFakeProgress < 0.8) currentFakeProgress += 0.05;
        else if (currentFakeProgress < 0.95) currentFakeProgress += 0.01;
        onProgress(currentFakeProgress);
      }, 500);
    }

    let result;
    try {
      result = await downloadResumable.downloadAsync();
    } finally {
      if (fakeProgressInterval) clearInterval(fakeProgressInterval);
    }
    
    if (!result || result.status !== 200) {
      throw new Error('The download did not complete. Please try again.');
    }
    if (onProgress) onProgress(1);

    // 5. Save to Media Library (Gallery)
    const asset = await MediaLibrary.createAssetAsync(result.uri);
    try {
      // Explicitly using the album name 'Download'
      await MediaLibrary.createAlbumAsync('Download', asset, false);
    } catch (albumErr) {
      console.warn('Could not move to Download album, but file is saved to default gallery.');
    }
    
    // 6. Save to History (SQLite)
    if (meta) {
      const { saveDownload } = require('../services/db');
      await saveDownload({
        id: Date.now().toString(),
        title: meta.title || 'Unknown Title',
        url: meta.url || url,
        platform: meta.platform || 'unknown',
        format: meta.format || null,
        filesize_mb: result.headers && result.headers['Content-Length'] ? (parseInt(result.headers['Content-Length']) / 1024 / 1024).toFixed(2) : 0,
        filepath: result.uri,
        thumbnail: meta.thumbnail || null,
        duration: meta.duration || 0,
      });
    }

    return true;
  } catch (error) {
    console.error('Download error:', error);
    Alert.alert('Download Did Not Work', 'Something went wrong while saving the file. Please check your internet connection and try again.');
    return false;
  }
};

