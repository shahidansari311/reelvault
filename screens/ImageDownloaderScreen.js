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
  Share,
  Image,
  Dimensions,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  Download, 
  Link2 as LinkIcon, 
  Share2,
  ChevronLeft,
  Shield,
  Image as ImageIcon
} from 'lucide-react-native';
import { COLORS, SPACING, SHADOWS } from '../constants/Theme';
import { fetchReelData } from '../services/api';
import { downloadFile } from '../utils/download';
import { CustomInput } from '../components/CustomInput';
import { ProgressBar } from '../components/ProgressBar';

const { width } = Dimensions.get('window');

export default function ImageDownloaderScreen({ navigation, route }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchProgress, setFetchProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [imageData, setImageData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (route.params?.autoPaste) {
      handlePaste();
    } else {
      checkClipboard();
    }
  }, [route.params?.autoPaste]);

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text.includes('instagram.com/')) {
      setUrl(text);
    }
  };

  const checkClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    const isInstagram = text.includes('instagram.com/') || text.includes('instagr.am/');
    if (isInstagram && (text.includes('/p/') || text.includes('/reel/'))) {
      setUrl(text);
    }
  };

  const handleFetch = async () => {
    if (!url) return;
    Keyboard.dismiss();
    setLoading(true);
    setFetchProgress(0);
    setImageData(null);
    setError(null);

    // Simulated progress for extraction
    const interval = setInterval(() => {
      setFetchProgress(prev => {
        if (prev >= 0.9) return prev;
        return prev + 0.1;
      });
    }, 400);

    try {
      const data = await fetchReelData(url); // the backend handles images via yt-dlp as well
      clearInterval(interval);
      setFetchProgress(1);
      setTimeout(() => {
        setImageData(data);
        setLoading(false);
      }, 500);
    } catch (err) {
      clearInterval(interval);
      const serverData = err.response?.data;
      const status = err.response?.status;

      let errorTitle = serverData?.error || 'Something Went Wrong';
      let errorMsg = serverData?.message || err.message || 'We couldn\'t get this image. Please check the link and try again.';

      if (status === 403) {
        errorTitle = serverData?.error || 'This Account is Private';
        errorMsg = serverData?.message || 'This Post belongs to a private account. We can only download from public accounts.';
      } else if (status === 404) {
        errorTitle = serverData?.error || 'Post Not Found';
        errorMsg = serverData?.message || 'This Post was not found. It may have been deleted or the link is wrong.';
      }

      setError({ title: errorTitle, message: errorMsg });
      setLoading(false);
    }
  };


  const handleDownload = async () => {
    if (!imageData?.videoUrl) return; // Note: videoUrl property contains the image link from the generic API
    setDownloading(true);
    setDownloadProgress(0);
    
    const fileName = `image_${Date.now()}.jpg`;
    const success = await downloadFile(
      imageData.videoUrl, 
      fileName, 
      (progress) => setDownloadProgress(progress)
    );
    
    if (success) {
      Alert.alert('Saved!', 'Image saved to your gallery.');
    }
    setDownloading(false);
    setDownloadProgress(0);
  };

  const handleShare = async () => {
    if (!imageData?.videoUrl) return;
    try {
      await Share.share({
        message: `Check out this Image I found via SaveX! \n\n${url}`,
        url: imageData.videoUrl
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <LinearGradient 
      colors={['#0A0A0B', '#151518', '#050505']} 
      style={styles.container}
    >
      <LinearGradient 
        colors={['rgba(180, 185, 255, 0.03)', 'transparent', 'transparent']} 
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {/* Navbar */}
      <View style={[styles.navbar, { justifyContent: 'center' }]}>
        <TouchableOpacity style={{ position: 'absolute', left: 0, top: 45, padding: 15 }} onPress={() => navigation.goBack()}>
          <ChevronLeft color={COLORS.text} size={28} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Shield color={COLORS.primary} size={18} style={{ marginRight: 8 }} />
          <Text style={styles.navTitle}>SAVEX</Text>
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 150 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>
            Download <Text style={{ fontStyle: 'italic', fontWeight: '400', color: COLORS.primary }}>Image.</Text>
          </Text>
          <Text style={styles.heroSub}>
            Vault your favorite photo posts in high-definition. Simply paste the link below to begin the extraction.
          </Text>
          
          <TouchableOpacity 
            style={styles.switchModeBtn}
            onPress={() => navigation.navigate('Reels')}
          >
            <Text style={styles.switchModeText}>🎥 Download Reel Instead</Text>
          </TouchableOpacity>
        </View>

        {/* Input Card */}
        <View style={styles.extractionCard}>
          <CustomInput
            placeholder="https://www.instagram.com/p/..."
            value={url}
            onChangeText={(text) => {
              setUrl(text);
              setError(null);
            }}
            onClear={() => setUrl('')}
            icon={LinkIcon}
            suffix={() => (
              <TouchableOpacity style={styles.inlinePasteBtn} onPress={handlePaste}>
                <Text style={styles.pasteBubbleText}>Paste</Text>
              </TouchableOpacity>
            )}
          />
          
          <TouchableOpacity 
            style={[styles.fetchBtn, loading && { opacity: 0.7 }]} 
            onPress={handleFetch}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.fetchBtnText}>EXTRACT IMAGE</Text>
            )}
          </TouchableOpacity>

          {loading && (
            <View style={{ marginTop: 24 }}>
              <ProgressBar progress={fetchProgress} label="Extracting Image" />
            </View>
          )}

          {error && (
            <View style={styles.errorBubble}>
              <View style={styles.errorIconHeader}>
                <Shield color="#FF6B6B" size={16} />
                <Text style={styles.errorTitle}>{error.title}</Text>
              </View>
              <Text style={styles.errorBody}>{error.message}</Text>
            </View>
          )}
        </View>



        {/* Preview & Metadata */}
        {imageData && (
          <View style={styles.previewContainer}>
            <View style={styles.previewFrame}>
              {imageData.videoUrl ? (
                <Image
                  source={{ uri: imageData.videoUrl }}
                  style={styles.imagePlayer}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.thumbnailPlaceholder}>
                  <ImageIcon color={COLORS.text} size={40} />
                </View>
              )}
            </View>


            {downloading && (
              <ProgressBar progress={downloadProgress} label="Downloading Image" />
            )}

            <View style={styles.metaCard}>
              <Text style={styles.metaTitle}>{imageData.title || 'Extracted Image'}</Text>
              
              <TouchableOpacity 
                style={[styles.downloadActionBtn, downloading && { opacity: 0.5, backgroundColor: COLORS.textSecondary }]}
                onPress={handleDownload}
                disabled={downloading}
              >
                {downloading ? (
                  <ActivityIndicator color="#000" size="small" style={{ marginRight: 10 }} />
                ) : (
                  <Download color="#000" size={18} style={{ marginRight: 10 }} />
                )}
                <Text style={styles.downloadActionText}>
                  {downloading ? `Downloading ${Math.round(downloadProgress * 100)}%` : 'Download Image'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.shareActionBtn, downloading && { opacity: 0.5 }]} 
                onPress={handleShare}
                disabled={downloading}
              >
                <Share2 color={COLORS.textSecondary} size={16} />
                <Text style={styles.shareActionText}>SHARE LINK</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: SPACING.lg,
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 100,
    paddingTop: 50,
  },
  navTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  heroSection: {
    marginTop: 30,
    marginBottom: 30,
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 42,
    fontWeight: '900',
  },
  heroSub: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 10,
    lineHeight: 22,
    opacity: 0.8,
  },
  switchModeBtn: {
    marginTop: 15,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  switchModeText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: 'bold',
  },
  extractionCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    marginBottom: 40,
  },
  inlinePasteBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.26)',
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pasteBubbleText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  fetchBtn: {
    backgroundColor: COLORS.primary,
    height: 60,
    borderRadius: 30,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    ...SHADOWS.primary,
  },
  fetchBtnText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '900',
  },
  previewContainer: {
    marginTop: 10,
    marginBottom: 40,
  },
  previewFrame: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...SHADOWS.glass,
  },
  imagePlayer: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  metaCard: {
    backgroundColor: COLORS.surface,
    padding: 24,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    marginBottom: 24,
    alignItems: 'center',
  },
  metaTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 20,
  },
  downloadActionBtn: {
    backgroundColor: COLORS.primary,
    height: 60,
    borderRadius: 18,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  downloadActionText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  shareActionBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    width: '100%',
  },
  shareActionText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 8,
    letterSpacing: 2,
  },
  errorBubble: {
    backgroundColor: 'rgba(255,107,107,0.05)',
    borderRadius: 20,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.1)',
  },
  errorIconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  errorTitle: {
    color: '#FF6B6B',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  errorBody: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    lineHeight: 18,
  },
});
