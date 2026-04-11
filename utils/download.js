import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Alert } from 'react-native';

export const downloadFile = async (url, fileName, type = 'video') => {
  try {
    // 1. Request Permissions
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Please allow media library access to save files.');
      return false;
    }

    // 2. Define local URI
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;

    // 3. Download the file
    const downloadResumable = FileSystem.createDownloadResumable(
      url,
      fileUri,
      {},
      (downloadProgress) => {
        // Optional: track progress if needed
      }
    );

    const { uri } = await downloadResumable.downloadAsync();
    console.log('Finished downloading to ', uri);

    // 4. Save to Media Library (Gallery)
    const asset = await MediaLibrary.createAssetAsync(uri);
    await MediaLibrary.createAlbumAsync('ReelVault', asset, false);

    return true;
  } catch (error) {
    console.error('Download error:', error);
    Alert.alert('Download Failed', 'Something went wrong while saving the file.');
    return false;
  }
};
