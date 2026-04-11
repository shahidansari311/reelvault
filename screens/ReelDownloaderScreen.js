import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Keyboard,
  Dimensions,
  ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Video } from 'expo-av';
import { Download, Link as LinkIcon } from 'lucide-react-native';
import { COLORS, SPACING } from '../constants/Theme';
import { fetchReelData } from '../services/api';
import { downloadFile } from '../utils/download';
import { CustomButton } from '../components/CustomButton';
import { CustomInput } from '../components/CustomInput';

const { width } = Dimensions.get('window');

export default function ReelDownloaderScreen() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [reelData, setReelData] = useState(null);

  useEffect(() => {
    checkClipboard();
  }, []);

  const checkClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    const isInstagram = text.includes('instagram.com/') || text.includes('instagr.am/');
    if (isInstagram && (text.includes('/reel/') || text.includes('/reels/') || text.includes('/p/'))) {
      setUrl(text);
    }
  };

  const handleFetch = async () => {
    if (!url) return;
    Keyboard.dismiss();
    setLoading(true);
    setReelData(null);

    try {
      const data = await fetchReelData(url);
      setReelData(data);
    } catch (error) {
      const msg = error.response?.data?.error || 'Could not fetch reel. Please check the link and try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!reelData?.videoUrl) return;
    setDownloading(true);
    
    const fileName = `ReelVault_${Date.now()}.mp4`;
    const success = await downloadFile(reelData.videoUrl, fileName);
    
    if (success) {
      Alert.alert('Success', 'Video saved to your gallery!');
    }
    setDownloading(false);
  };

  const clearInput = () => {
    setUrl('');
    setReelData(null);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Reel Downloader</Text>
      <Text style={styles.subtitle}>Paste the Instagram reel link below</Text>

      <CustomInput
        icon={LinkIcon}
        placeholder="https://www.instagram.com/reel/..."
        value={url}
        onChangeText={setUrl}
        onClear={clearInput}
      />

      <CustomButton
        title="Fetch Reel"
        onPress={handleFetch}
        loading={loading}
        disabled={!url}
        style={{ marginBottom: SPACING.xl }}
      />

      {reelData && (
        <View style={styles.previewContainer}>
          <Video
            source={{ uri: reelData.videoUrl }}
            rate={1.0}
            volume={1.0}
            isMuted={false}
            resizeMode="cover"
            shouldPlay
            isLooping
            useNativeControls
            style={styles.video}
          />
          
          <CustomButton
            title="Download to Gallery"
            onPress={handleDownload}
            loading={downloading}
            icon={Download}
            colors={[COLORS.success, '#3FA333']}
            style={{ marginTop: SPACING.md }}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.xl,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xl,
    textAlign: 'center',
  },
  previewContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: SPACING.md,
    borderRadius: 16,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: width * 1.2,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
  },
});
