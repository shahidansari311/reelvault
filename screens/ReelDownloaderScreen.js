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
import { Video, ResizeMode } from 'expo-av';
import { 
  Download, 
  Link2 as LinkIcon, 
  History as HistoryIcon, 
  Trash2,
  Share2,
  CheckCircle,
  Play,
  LayoutGrid,
  ChevronLeft,
  Shield
} from 'lucide-react-native';
import { COLORS, SPACING, SHADOWS } from '../constants/Theme';
import { fetchReelData } from '../services/api';
import { downloadFile } from '../utils/download';
import { CustomButton } from '../components/CustomButton';
import { CustomInput } from '../components/CustomInput';

import { useIsFocused } from '@react-navigation/native';

const { width } = Dimensions.get('window');

export default function ReelDownloaderScreen({ navigation, route }) {
  const isFocused = useIsFocused();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [reelData, setReelData] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (route.params?.autoPaste) {
      handlePaste();
    } else {
      checkClipboard();
    }
    loadHistory();
  }, [route.params?.autoPaste]);

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text.includes('instagram.com/')) {
      setUrl(text);
      // Optional: automatically trigger handleFetch() if you want it even faster
    }
  };

  const loadHistory = async () => {
    try {
      const saved = await AsyncStorage.getItem('reel_history');
      if (saved) setHistory(JSON.parse(saved));
    } catch (e) {
      console.error(e);
    }
  };

  const saveToHistory = async (data) => {
    try {
      const newHistory = [data, ...history.filter(h => h.videoUrl !== data.videoUrl)].slice(0, 10);
      setHistory(newHistory);
      await AsyncStorage.setItem('reel_history', JSON.stringify(newHistory));
    } catch (e) {
      console.error(e);
    }
  };

  const clearHistory = async () => {
    setHistory([]);
    await AsyncStorage.removeItem('reel_history');
  };

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
      saveToHistory({ ...data, date: new Date().toISOString(), originalUrl: url });
    } catch (err) {
      const errorTitle = err.response?.data?.error || 'Broken Link';
      const errorMsg = err.response?.data?.message || 'This video could not be found. Please check the link and try again.';
      setError({ title: errorTitle, message: errorMsg });
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

  const handleShare = async () => {
    if (!reelData?.videoUrl) return;
    try {
      await Share.share({
        message: `Check out this Reel I found via ReelVault! \n\n${url}`,
        url: reelData.videoUrl
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
          <Text style={styles.navTitle}>REELVAULT</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150 }}>
        {/* Title Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>
            Download <Text style={{ fontStyle: 'italic', fontWeight: '400', color: COLORS.primary }}>Reel.</Text>
          </Text>
          <Text style={styles.heroSub}>
            Vault your favorite cinematic moments in high-definition. Simply paste the link below to begin the extraction.
          </Text>
        </View>

        {/* Input Card */}
        <View style={styles.extractionCard}>
          <CustomInput
            placeholder="https://www.instagram.com/reel/..."
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
            <Text style={styles.fetchBtnText}>{loading ? 'Resolving Archive...' : 'EXTRACT MEDIA'}</Text>
          </TouchableOpacity>

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
        {reelData && (
          <View style={styles.previewContainer}>
            <View style={styles.previewFrame}>
              {reelData.videoUrl ? (
                <Video
                  source={{ uri: reelData.videoUrl }}
                  rate={1.0}
                  volume={1.0}
                  isMuted={false}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={isFocused}
                  isLooping
                  style={styles.videoPlayer}
                  useNativeControls
                />
              ) : (
                <View style={styles.thumbnailPlaceholder}>
                  <Play color={COLORS.text} size={40} />
                </View>
              )}
            </View>

            <View style={styles.metaCard}>
              <Text style={styles.metaTitle}>{reelData.title || 'Extracted Reel'}</Text>
              
              <TouchableOpacity 
                style={[styles.downloadActionBtn, downloading && { opacity: 0.7 }]}
                onPress={handleDownload}
                disabled={downloading}
              >
                <Download color="#000" size={18} />
                <Text style={styles.downloadActionText}>{downloading ? 'Downloading...' : 'Download Reel'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.shareActionBtn} onPress={handleShare}>
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
  extractionCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    marginBottom: 40,
  },
  inputBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 60,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 1)',
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    marginHorizontal: 12,
    height: '100%',
  },
  pasteBubbleBtn: {
    backgroundColor: 'rgba(55, 51, 51, 0.83)',
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
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
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  metaCard: {
    backgroundColor: COLORS.surface,
    padding: 24,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    marginBottom: 24,
    alignItems: 'center', // Center content horizontally
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
  creatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  creatorAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  creatorInfo: {
    marginLeft: 16,
  },
  creatorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creatorName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  creatorDetail: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  emptyHistoryText: {
    color: COLORS.textSecondary,
    fontSize: 14,
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
