// SDK 54+: createDownloadResumable lives on the legacy API; main entry throws if used from non-legacy import.
import * as FileSystem from 'expo-file-system/legacy';
import { getMediaLibrary } from './mediaLibrary';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { showAlert } from './alert';

// NativeDownload access is guarded: if the native module fails to register
// (e.g. stale build), the property lookup itself throws — fall back to null
// so the app boots and uses the expo-file-system path instead of redboxing.
let NativeDownload = null;
let nativeDownloadWarned = false;
try {
  NativeDownload = NativeModules?.NativeDownload ?? null;
} catch (e) {
  // Expected on phone builds predating the native fix — downloads fall
  // back automatically. Single quiet line so the console stays clean.
  if (!nativeDownloadWarned) {
    nativeDownloadWarned = true;
    console.log('NativeDownload unavailable, using fallback downloads.');
  }
}

// Event emitter for listening to native download progress/completion
let downloadEmitter = null;
const getEmitter = () => {
  if (!downloadEmitter && NativeDownload) {
    downloadEmitter = new NativeEventEmitter(NativeDownload);
  }
  return downloadEmitter;
};

/**
 * Get or initialize base download folder URI via StorageAccessFramework (Android only).
 * Asks user ONCE on first run and persists to AsyncStorage.
 */
export const getOrInitBaseFolderUri = async () => {
  if (Platform.OS !== 'android') return null;
  try {
    const saved = await AsyncStorage.getItem('savex_base_folder_uri');
    if (saved) return saved;

    if (!FileSystem.StorageAccessFramework) return null;

    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (permissions && permissions.granted) {
      await AsyncStorage.setItem('savex_base_folder_uri', permissions.directoryUri);
      return permissions.directoryUri;
    }
    return null;
  } catch (err) {
    console.warn('Error obtaining base folder URI:', err);
    return null;
  }
};

/**
 * Determine organized subfolder name from download metadata.
 */
export const getSubfolderName = (meta) => {
  if (!meta) return 'SaveX Downloads';
  const platform = (meta.platform || '').toLowerCase();
  const format = (meta.format || '').toLowerCase();
  const kind = (meta.kind || '').toLowerCase();

  if (platform === 'instagram') {
    if (format.includes('story')) return 'Instagram Stories';
    if (format.includes('mp4') || format.includes('video')) return 'Instagram Videos';
    return 'Instagram Videos';
  }

  if (platform === 'youtube') {
    if (kind === 'audio' || format.includes('mp3')) return 'YouTube Audios';
    if (kind === 'video' || format.includes('mp4')) return 'YouTube Videos';
    return 'YouTube Videos';
  }

  return 'SaveX Downloads';
};

/**
 * Start a true background download using Android's DownloadManager.
 * - Continues even if the app is closed/killed
 * - Shows Chrome-like progress in the notification bar
 * - Saves to Downloads/SaveX/ folder
 *
 * Falls back to expo-file-system for non-Android or if the native module is missing.
 *
 * @param {string} url        - Direct download URL
 * @param {string} fileName   - Target filename
 * @param {function} onProgress - Progress callback (0.0 to 1.0)
 * @param {object} meta        - Metadata for history (title, platform, format, thumbnail, duration, url)
 * @returns {Promise<boolean>} - true if download started/completed successfully
 */
export const downloadFile = async (url, fileName, onProgress, meta = null) => {
  try {
    // 1. Verify permissions (never re-prompt — App.js already asked once at startup)
    //    The native DownloadManager path doesn't need MediaLibrary permission at all
    //    (it writes to public Downloads/SaveX/), but the expo-file-system fallback does.
    if (Platform.OS === 'android' && NativeDownload) {
      // Native path — skip permission check entirely, DownloadManager handles it
      return await startNativeBackgroundDownload(url, fileName, onProgress, meta);
    }

    // Expo fallback path — needs the native media-library module.
    const MediaLibrary = getMediaLibrary();
    if (!MediaLibrary) {
      showAlert(
        'Update Required',
        'Saving to the gallery needs a fresh app build. Please install the latest development build.'
      );
      return false;
    }

    // Check if permission was already granted at launch
    const { status } = await MediaLibrary.getPermissionsAsync(true);
    if (status !== 'granted') {
      showAlert(
        'Permission Required',
        'Storage access is needed to save files. Please enable it in Settings.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return false;
    }

    // 3. Fallback: expo-file-system download (foreground only)
    return await startExpoDownload(url, fileName, onProgress, meta);

  } catch (error) {
    console.error('Download error:', error);
    showAlert('Download Did Not Work', 'Something went wrong while saving the file. Please check your internet connection and try again.');
    return false;
  }
};

/**
 * Native Android DownloadManager path.
 * Downloads continue in background even if the app is killed.
 * Progress is shown in the Android notification bar.
 */
async function startNativeBackgroundDownload(url, fileName, onProgress, meta) {
  const title = meta?.title || fileName;
  const isAudio = fileName.endsWith('.mp3') || fileName.endsWith('.m4a') || meta?.format?.toLowerCase()?.includes('mp3');
  const mimeType = isAudio ? 'audio/mpeg' : 'video/mp4';

  return new Promise(async (resolve) => {
    let progressSub = null;
    let completeSub = null;
    let downloadId = null;

    const cleanup = () => {
      if (progressSub) { progressSub.remove(); progressSub = null; }
      if (completeSub) { completeSub.remove(); completeSub = null; }
    };

    try {
      const emitter = getEmitter();

      // Listen for progress events
      if (emitter && onProgress) {
        progressSub = emitter.addListener('downloadProgress', (event) => {
          if (event.downloadId === downloadId) {
            onProgress(event.progress);
          }
        });
      }

      // Listen for completion event
      if (emitter) {
        completeSub = emitter.addListener('downloadComplete', async (event) => {
          if (event.downloadId !== downloadId) return;
          cleanup();

          if (event.success) {
            if (onProgress) onProgress(1);

            // Save to History (SQLite)
            if (meta) {
              await saveToHistory(meta, url, fileName, event.bytesTotal, event.localUri);
            }
            resolve(true);
          } else {
            showAlert('Download Failed', 'The file could not be saved. Please try again.');
            resolve(false);
          }
        });
      }

      // Start the download — returns download ID
      downloadId = await NativeDownload.startDownload(url, fileName, title, mimeType, 'SaveX');

      // Safety timeout: if we don't get a completion event in 10 minutes, resolve anyway
      setTimeout(() => {
        if (progressSub || completeSub) {
          cleanup();
          if (onProgress) onProgress(1);
          resolve(true);
        }
      }, 10 * 60 * 1000);

    } catch (error) {
      cleanup();
      console.error('Native download error:', error);

      // Fallback: retry once with default mime/subdir via the promise API
      // (the old 3-arg overload was removed — TurboModules forbid duplicates)
      try {
        const retryAudio = fileName.endsWith('.mp3') || fileName.endsWith('.m4a');
        await NativeDownload.startDownload(
          url,
          fileName,
          title,
          retryAudio ? 'audio/mpeg' : 'video/mp4',
          'SaveX'
        );
        if (onProgress) onProgress(1);
        if (meta) {
          await saveToHistory(meta, url, fileName, 0, `file:///storage/emulated/0/Download/SaveX/${fileName}`);
        }
        resolve(true);
      } catch (fallbackErr) {
        console.error('Fallback download also failed:', fallbackErr);
        resolve(false);
      }
    }
  });
}

/**
 * Expo FileSystem download path (foreground only).
 * Used as fallback when native module is unavailable.
 */
async function startExpoDownload(url, fileName, onProgress, meta) {
  const fileUri = `${FileSystem.documentDirectory}${fileName}`;
  
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

  // Fake progress fallback (when server doesn't send Content-Length)
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

  let finalUri = result.uri;

  try {
    // Step 2: Copy directly to app's permanent documents folder
    const permanentDir = FileSystem.documentDirectory + 'SAVEX/';
    await FileSystem.makeDirectoryAsync(permanentDir, { intermediates: true });
    const permanentPath = permanentDir + fileName;
    
    // Use copy to avoid the modify permission dialog
    await FileSystem.copyAsync({ from: result.uri, to: permanentPath });
    finalUri = permanentPath;

    // Step 3: Add to gallery using the permanent path — only asks ONCE ever
    // (MediaLibrary was already resolved in downloadFile before reaching here)
    const MediaLibrary = getMediaLibrary();
    const asset = await MediaLibrary.createAssetAsync(permanentPath);
    if (Platform.OS !== 'android') {
      await MediaLibrary.createAlbumAsync('SaveX', asset, false);
    }

    // Step 4: Organized folder saving via SAF if enabled
    try {
      const baseFolderUri = await getOrInitBaseFolderUri();
      if (baseFolderUri && FileSystem.StorageAccessFramework) {
        const subfolderName = getSubfolderName(meta);
        // Create the subfolder
        const subfolderUri = await FileSystem.StorageAccessFramework.makeDirectoryAsync(baseFolderUri, subfolderName).catch(() => baseFolderUri);
        // Copy file to subfolder
        const isAudio = fileName.endsWith('.mp3') || meta?.format?.toLowerCase()?.includes('mp3');
        const mimeType = isAudio ? 'audio/mpeg' : 'video/mp4';
        const targetUri = await FileSystem.StorageAccessFramework.createFileAsync(subfolderUri || baseFolderUri, fileName, mimeType);
        const base64 = await FileSystem.readAsStringAsync(finalUri, { encoding: FileSystem.EncodingType.Base64 });
        await FileSystem.writeAsStringAsync(targetUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      }
    } catch (folderErr) {
      console.warn('Could not save to organized folder, file is still saved to gallery', folderErr);
    }

    // Clean up cache
    await FileSystem.deleteAsync(result.uri, { idempotent: true });
  } catch (albumErr) {
    console.warn('Could not move to SaveX album, but file is saved.', albumErr);
    // Fallback: try creating asset directly from result if copy fails
    try {
      if (finalUri === result.uri && MediaLibrary) {
        await MediaLibrary.createAssetAsync(result.uri);
      }
    } catch(e) {
      console.warn('Fallback asset creation failed', e);
    }
  }
  
  // Save to History (SQLite)
  if (meta) {
    const fileSizeMB = result.headers && result.headers['Content-Length'] 
      ? (parseInt(result.headers['Content-Length']) / 1024 / 1024).toFixed(2) 
      : 0;
    await saveToHistory(meta, url, fileName, fileSizeMB, finalUri);
  }

  return true;
}

/**
 * Persist download metadata to SQLite history.
 */
async function saveToHistory(meta, url, fileName, bytesOrMB, filepath) {
  try {
    const { saveDownload } = require('../services/db');
    const fileSizeMB = typeof bytesOrMB === 'number' && bytesOrMB > 1000
      ? (bytesOrMB / 1024 / 1024).toFixed(2)
      : bytesOrMB;

    await saveDownload({
      id: Date.now().toString(),
      title: meta.title || 'Unknown Title',
      url: meta.url || url,
      platform: meta.platform || 'unknown',
      format: meta.format || null,
      filesize_mb: fileSizeMB,
      filepath: filepath || `file:///storage/emulated/0/Download/SaveX/${fileName}`,
      thumbnail: meta.thumbnail || null,
      duration: meta.duration || 0,
    });
  } catch (err) {
    console.warn('Could not save to download history:', err);
  }
}
