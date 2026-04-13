import * as FileSystem from 'expo-file-system/legacy';

import * as MediaLibrary from 'expo-media-library';
import { Alert, Linking } from 'react-native';

export const downloadFile = async (url, fileName, onProgress) => {
  try {
    // 1. Request/Check Permissions (Write-only avoids the AUDIO permission error)
    const { status } = await MediaLibrary.requestPermissionsAsync(true);

    
    if (status !== 'granted') {

      Alert.alert(
        'Permission Required',
        'Allow storage access to download reels',
        [
          { text: 'Cancel', style: 'cancel' },
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
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        if (onProgress) {
          onProgress(progress);
        }
      }
    );

    // 4. Start Download
    const result = await downloadResumable.downloadAsync();
    
    if (!result || result.status !== 200) {
      throw new Error('Download failed');
    }

    // 5. Save to Media Library (Gallery)
    const asset = await MediaLibrary.createAssetAsync(result.uri);
    // Explicitly using the album name 'ReelVault'
    await MediaLibrary.createAlbumAsync('ReelVault', asset, false);
    
    return true;
  } catch (error) {
    console.error('Download error:', error);
    Alert.alert('Download Failed', error.message || 'An error occurred while downloading the file.');
    return false;
  }
};

