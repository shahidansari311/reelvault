// SDK 54+: createDownloadResumable lives on the legacy API; main entry throws if used from non-legacy import.
import * as FileSystem from 'expo-file-system/legacy';

import * as MediaLibrary from 'expo-media-library';
import { Alert, Linking, NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { NativeDownload } = NativeModules;

// Event emitter for listening to native download progress/completion
let downloadEmitter = null;
const getEmitter = () => {
  if (!downloadEmitter && NativeDownload) {
    downloadEmitter = new NativeEventEmitter(NativeDownload);
  }
  return downloadEmitter;
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
    // 1. Check Permissions (Write-only avoids the AUDIO permission error)
    let { status } = await MediaLibrary.getPermissionsAsync(true);
    if (status !== 'granted') {
      const Storage = require('@react-native-async-storage/async-storage').default;
      const hasAsked = await Storage.getItem('hasAskedMediaPerm');
      
      if (!hasAsked) {
        const response = await MediaLibrary.requestPermissionsAsync(true);
        status = response.status;
        await Storage.setItem('hasAskedMediaPerm', 'true');
      }
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

    // 2. Use Native Background Downloader (Android DownloadManager)
    if (Platform.OS === 'android' && NativeDownload) {
      return await startNativeBackgroundDownload(url, fileName, onProgress, meta);
    }

    // 3. Fallback: expo-file-system download (foreground only)
    return await startExpoDownload(url, fileName, onProgress, meta);

  } catch (error) {
    console.error('Download error:', error);
    Alert.alert('Download Did Not Work', 'Something went wrong while saving the file. Please check your internet connection and try again.');
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
  const mimeType = isAudio ? 'audio/mp4' : 'video/mp4';

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
            Alert.alert('Download Failed', 'The file could not be saved. Please try again.');
            resolve(false);
          }
        });
      }

      // Start the download — returns download ID
      downloadId = await NativeDownload.startDownload(url, fileName, title, mimeType, 'SaveX');

      // Safety timeout: if we don't get a completion event in 10 minutes, resolve anyway
      // (The download continues in background regardless)
      setTimeout(() => {
        if (progressSub || completeSub) {
          cleanup();
          // Don't alert — the download is likely still running in background
          if (onProgress) onProgress(1);
          resolve(true);
        }
      }, 10 * 60 * 1000);

    } catch (error) {
      cleanup();
      console.error('Native download error:', error);

      // Fallback: try the legacy fire-and-forget method
      try {
        NativeDownload.startDownload(url, fileName, title);
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

  // Save to Media Library (Gallery)
  const asset = await MediaLibrary.createAssetAsync(result.uri);
  try {
    await MediaLibrary.createAlbumAsync('SaveX', asset, false);
  } catch (albumErr) {
    console.warn('Could not move to SaveX album, but file is saved to default gallery.');
  }
  
  // Save to History (SQLite)
  if (meta) {
    const fileSizeMB = result.headers && result.headers['Content-Length'] 
      ? (parseInt(result.headers['Content-Length']) / 1024 / 1024).toFixed(2) 
      : 0;
    await saveToHistory(meta, url, fileName, fileSizeMB, result.uri);
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
