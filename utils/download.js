// SDK 54+: createDownloadResumable lives on the legacy API; main entry throws if used from non-legacy import.
import * as FileSystem from 'expo-file-system/legacy';

import * as MediaLibrary from 'expo-media-library';
import { Alert, Linking } from 'react-native';

export const downloadFile = async (url, fileName, onProgress) => {
  try {
    // 1. Request/Check Permissions (Write-only avoids the AUDIO permission error)
    const { status } = await MediaLibrary.requestPermissionsAsync(true);

    
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
    const downloadResumable = FileSystem.createDownloadResumable(
      url,
      fileUri,
      {},
      (downloadProgress) => {
        const denom = downloadProgress.totalBytesExpectedToWrite || 0;
        const progress = denom > 0 ? (downloadProgress.totalBytesWritten / denom) : 0;
        if (onProgress) {
          onProgress(progress);
        }
      }
    );

    // 4. Start Download
    const result = await downloadResumable.downloadAsync();
    
    if (!result || result.status !== 200) {
      throw new Error('The download did not complete. Please try again.');
    }
    if (onProgress) onProgress(1);

    // 5. Save to Media Library (Gallery)
    const asset = await MediaLibrary.createAssetAsync(result.uri);
    // Explicitly using the album name 'SaveX'
    await MediaLibrary.createAlbumAsync('SaveX', asset, false);
    
    return true;
  } catch (error) {
    console.error('Download error:', error);
    Alert.alert('Download Did Not Work', 'Something went wrong while saving the file. Please check your internet connection and try again.');
    return false;
  }
};

