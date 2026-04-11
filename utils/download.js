import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Alert } from 'react-native';

export const downloadFile = async (url, fileName, type = 'video') => {
  try {
    // 1. Request Permissions (Modern Android 13+ Best Practice: WriteOnly)
    const permission = await MediaLibrary.getPermissionsAsync(true); 
    let status = permission.status;

    if (status !== 'granted') {
      const resp = await MediaLibrary.requestPermissionsAsync(true); 
      status = resp.status;
    }

    if (status !== 'granted') {
      Alert.alert('Permission Required', 'ReelVault needs gallery access to save videos. Please enable it in settings.');
      return false;
    }

    // 2. Define local URI
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;
    console.log('Starting download to:', fileUri);

    // 3. Download the file
    const { uri } = await FileSystem.downloadAsync(url, fileUri);
    console.log('Download complete at:', uri);

    // 4. Save to Media Library (Gallery)
    const asset = await MediaLibrary.createAssetAsync(uri);
    await MediaLibrary.createAlbumAsync('ReelVault', asset, false);
    console.log('Saved to gallery successfully');

    return true;
  } catch (error) {
    console.error('CRITICAL Download error:', error);
    Alert.alert('Download Failed', `Error: ${error.message || 'Unknown conflict'}\nPlease ensure the app has storage permissions.`);
    return false;
  }
};
