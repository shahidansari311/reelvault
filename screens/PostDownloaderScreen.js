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
  Animated,
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
  Shield,
  Video as VideoIcon,
  Image as ImageIcon
} from 'lucide-react-native';
import { COLORS, SPACING, SHADOWS } from '../constants/Theme';
import { fetchReelData } from '../services/api';
import { downloadFile } from '../utils/download';
import { CustomInput } from '../components/CustomInput';
import { ProgressBar } from '../components/ProgressBar';
import { useIsFocused } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const PreviewCard = ({ reelData, downloading, downloadProgress, handleDownload, handleShare, isFocused }) => {
  const isVideo = reelData.videoUrl.includes('.mp4') || reelData.videoUrl.includes('video');
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.95)).current;
  
  React.useEffect(() => {
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.95);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true })
    ]).start();
  }, [reelData]);

  return (
    <Animated.View style={[styles.previewContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      <View style={styles.previewFrame}>
        {isVideo ? (
          <Video
            key={reelData.videoUrl} 
            source={{ uri: reelData.videoUrl }}
            rate={1.0}
            volume={1.0}
            isMuted={false}
            resizeMode={ResizeMode.COVER}
            shouldPlay={isFocused && !downloading}
            isLooping
            style={styles.videoPlayer}
            useNativeControls={!downloading}
          />
        ) : (
          <Image
            source={{ uri: reelData.videoUrl }}
            style={styles.videoPlayer}
            resizeMode="contain"
          />
        )}
      </View>

      {downloading && (
        <ProgressBar progress={downloadProgress} label={`Downloading ${isVideo ? 'Video' : 'Photo'}`} />
      )}

      <LinearGradient colors={['rgba(20,20,25,0.8)', 'rgba(10,10,15,0.95)']} style={styles.metaCard}>
        <View style={styles.metaHeader}>
          <View style={styles.metaIconContainer}>
            {isVideo ? <VideoIcon color={COLORS.primary} size={20} /> : <ImageIcon color={COLORS.primary} size={20} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.metaTitle} numberOfLines={1}>{reelData.title || (isVideo ? 'Extracted Video' : 'Extracted Photo')}</Text>
            <Text style={styles.metaSubtitle}>{isVideo ? 'High-Definition MP4' : 'Original JPG Image'}</Text>
          </View>
        </View>
        
        <View style={styles.actionGrid}>
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
              {downloading ? `SAVING ${Math.round(downloadProgress * 100)}%` : `SAVE ${isVideo ? 'VIDEO' : 'PHOTO'}`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.shareActionBtn, downloading && { opacity: 0.5 }]} 
            onPress={handleShare}
            disabled={downloading}
          >
            <Share2 color={COLORS.text} size={20} />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

export default function PostDownloaderScreen({ navigation, route }) {
  const isFocused = useIsFocused();

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchProgress, setFetchProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
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
    setFetchProgress(0);
    setReelData(null);
    setError(null);

    // Simulated progress for extraction
    const interval = setInterval(() => {
      setFetchProgress(prev => {
        if (prev >= 0.9) return prev;
        return prev + 0.1;
      });
    }, 400);

    try {
      const data = await fetchReelData(url);
      clearInterval(interval);
      setFetchProgress(1);
      setReelData(data);
      saveToHistory({ ...data, date: new Date().toISOString(), originalUrl: url });
      setLoading(false);
    } catch (err) {
      clearInterval(interval);
      const serverData = err.response?.data;
      const status = err.response?.status;

      let errorTitle = serverData?.error || 'Something Went Wrong';
      let errorMsg = serverData?.message || err.message || 'We couldn\'t get this video. Please check the link and try again.';

      if (status === 403) {
        errorTitle = serverData?.error || 'This Account is Private';
        errorMsg = serverData?.message || 'This Reel belongs to a private account. We can only download from public accounts.';
      } else if (status === 404) {
        errorTitle = serverData?.error || 'Reel Not Found';
        errorMsg = serverData?.message || 'This Reel was not found. It may have been deleted or the link is wrong.';
      } else if (status === 429) {
        errorTitle = serverData?.error || 'Too Many Requests';
        errorMsg = serverData?.message || 'Instagram is limiting our access right now. Please wait a minute and try again.';
      } else if (status === 504) {
        errorTitle = serverData?.error || 'Taking Too Long';
        errorMsg = serverData?.message || 'The request took too long. Please try again.';
      } else if (!err.response) {
        errorTitle = 'No Internet';
        errorMsg = 'Could not connect to the server. Please check your internet connection.';
      }

      setError({ title: errorTitle, message: errorMsg });
      setLoading(false);
    }
  };


  const handleDownload = async () => {
    if (!reelData?.videoUrl) return;
    setDownloading(true);
    setDownloadProgress(0);
    
    const isVideo = reelData.videoUrl.includes('.mp4') || reelData.videoUrl.includes('video');
    const ext = isVideo ? 'mp4' : 'jpg';
    const fileName = `ig_media_${Date.now()}.${ext}`;
    
    const success = await downloadFile(
      reelData.videoUrl, 
      fileName, 
      (progress) => setDownloadProgress(progress),
      {
        title: reelData.title || (isVideo ? 'Instagram Reel' : 'Instagram Photo'),
        platform: 'instagram',
        format: isVideo ? 'MP4 Video' : 'JPG Image'
      }
    );
    
    if (success) {
      Alert.alert('Saved!', `${isVideo ? 'Video' : 'Photo'} saved to your gallery.`);
    }
    setDownloading(false);
    setDownloadProgress(0);
  };

  const handleShare = async () => {
    if (!reelData?.videoUrl) return;
    try {
      await Share.share({
        message: `Check out this Reel I found via SaveX! \n\n${url}`,
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
            Download <Text style={{ fontStyle: 'italic', fontWeight: '400', color: COLORS.primary }}>Posts.</Text>
          </Text>
          <Text style={styles.heroSub}>
            Vault your favorite Instagram photo posts in high-definition. Simply paste any Instagram link below to begin the extraction.
          </Text>
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
              <Text style={styles.fetchBtnText}>EXTRACT MEDIA</Text>
            )}
          </TouchableOpacity>

          {loading && (
            <View style={{ marginTop: 24 }}>
              <ProgressBar progress={fetchProgress} label="Extracting Post" />
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
        {reelData && (
          <PreviewCard 
            reelData={reelData}
            downloading={downloading}
            downloadProgress={downloadProgress}
            handleDownload={handleDownload}
            handleShare={handleShare}
            isFocused={isFocused}
          />
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
    padding: 24,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 24,
  },
  metaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  metaIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(180, 185, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  metaTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metaSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  actionGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  downloadActionBtn: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 18,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  downloadActionText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 8,
    letterSpacing: 1,
  },
  shareActionBtn: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
