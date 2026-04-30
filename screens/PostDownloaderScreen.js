import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Keyboard,
  Image,
  Dimensions,
  ScrollView,
  Animated,
  FlatList,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import {
  Download,
  Link2 as LinkIcon,
  ChevronLeft,
  Shield,
  Image as ImageIcon,
  ChevronRight,
  X,
} from 'lucide-react-native';
import { COLORS, SPACING, SHADOWS } from '../constants/Theme';
import { fetchPostData } from '../services/api';
import { downloadFile } from '../utils/download';
import { CustomInput } from '../components/CustomInput';
import { ProgressBar } from '../components/ProgressBar';

const { width, height } = Dimensions.get('window');

export default function PostDownloaderScreen({ navigation }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchProgress, setFetchProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [images, setImages] = useState([]);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text.includes('instagram.com/')) {
      setUrl(text);
    }
  };

  const handleFetch = async () => {
    if (!url) return;
    Keyboard.dismiss();
    setLoading(true);
    setFetchProgress(0);
    setImages([]);
    setError(null);

    const interval = setInterval(() => {
      setFetchProgress(prev => (prev >= 0.9 ? prev : prev + 0.1));
    }, 400);

    try {
      const data = await fetchPostData(url);
      clearInterval(interval);
      setFetchProgress(1);
      setImages(data.images || []);
      setLoading(false);
    } catch (err) {
      clearInterval(interval);
      const serverData = err.response?.data;
      const status = err.response?.status;

      let errorTitle = serverData?.error || 'Something Went Wrong';
      let errorMsg = serverData?.message || err.message || 'We couldn\'t get this post. Please check the link and try again.';

      if (status === 403) {
        errorTitle = serverData?.error || 'This Account is Private';
        errorMsg = serverData?.message || 'This post belongs to a private account. We can only download from public accounts.';
      } else if (status === 404) {
        errorTitle = serverData?.error || 'Post Not Found';
        errorMsg = serverData?.message || 'This post was not found. It may have been deleted or the link is wrong.';
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

  const handleDownloadImage = async (imageUrl, index) => {
    if (!imageUrl) return;
    setDownloading(true);
    setDownloadProgress(0);
    const fileName = `ig_post_${Date.now()}_${index || 0}.jpg`;

    const success = await downloadFile(
      imageUrl,
      fileName,
      (p) => setDownloadProgress(p),
      {
        title: 'Instagram Post',
        platform: 'instagram',
        format: 'JPG Image'
      }
    );

    if (success) {
      Alert.alert('Saved!', 'Photo saved to your gallery.');
    }
    setDownloading(false);
    setDownloadProgress(0);
  };

  const handleDownloadAll = async () => {
    if (images.length === 0) return;
    setDownloading(true);
    setDownloadProgress(0);

    for (let i = 0; i < images.length; i++) {
      setDownloadProgress((i) / images.length);
      const fileName = `ig_post_${Date.now()}_${i}.jpg`;
      await downloadFile(
        images[i],
        fileName,
        () => {},
        {
          title: `Instagram Post (${i + 1}/${images.length})`,
          platform: 'instagram',
          format: 'JPG Image'
        }
      );
    }

    setDownloadProgress(1);
    Alert.alert('Saved!', `${images.length} photo(s) saved to your gallery.`);
    setDownloading(false);
    setDownloadProgress(0);
  };

  const renderImageCard = (imageUrl, index) => {
    const fadeAnim = React.useRef(new Animated.Value(0)).current;
    React.useEffect(() => {
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: index * 80, useNativeDriver: true }).start();
    }, []);

    return (
      <Animated.View key={index} style={[styles.imageCard, { opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
        <TouchableOpacity
          onPress={() => setSelectedImage(imageUrl)}
          activeOpacity={0.85}
          style={styles.imageCardInner}
        >
          <Image source={{ uri: imageUrl }} style={styles.imageThumb} resizeMode="cover" />
          <View style={styles.imageOverlay}>
            <Text style={styles.imageIndex}>{index + 1}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.imageSaveBtn, downloading && { opacity: 0.5 }]}
          onPress={() => handleDownloadImage(imageUrl, index)}
          disabled={downloading}
        >
          <Download color="#000" size={16} />
          <Text style={styles.imageSaveBtnText}>Save</Text>
        </TouchableOpacity>
      </Animated.View>
    );
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
            Vault your favorite Instagram photo posts in high-definition. Supports single images & carousel posts with multiple photos.
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
            onClear={() => {
              setUrl('');
              setImages([]);
            }}
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
              <Text style={styles.fetchBtnText}>EXTRACT PHOTOS</Text>
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

        {/* Results Grid */}
        {images.length > 0 && (
          <View style={styles.resultsSection}>
            <View style={styles.resultsHeader}>
              <View style={styles.resultsCountBadge}>
                <ImageIcon color={COLORS.primary} size={16} />
                <Text style={styles.resultsCountText}>{images.length} Photo{images.length > 1 ? 's' : ''} Found</Text>
              </View>
              {images.length > 1 && (
                <TouchableOpacity
                  style={[styles.downloadAllBtn, downloading && { opacity: 0.5 }]}
                  onPress={handleDownloadAll}
                  disabled={downloading}
                >
                  <Download color="#000" size={16} style={{ marginRight: 6 }} />
                  <Text style={styles.downloadAllText}>Save All</Text>
                </TouchableOpacity>
              )}
            </View>

            {downloading && (
              <View style={{ marginBottom: 16 }}>
                <ProgressBar progress={downloadProgress} label="Downloading Photos" />
              </View>
            )}

            <View style={styles.imageGrid}>
              {images.map((img, i) => renderImageCard(img, i))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Full-screen Image Preview Modal */}
      <Modal
        visible={!!selectedImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => !downloading && setSelectedImage(null)}
      >
        <View style={styles.modalBackdrop}>
          <LinearGradient colors={['rgba(0,0,0,0.9)', 'transparent']} style={styles.modalTopNav}>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => !downloading && setSelectedImage(null)}
              disabled={downloading}
            >
              <X color="#FFF" size={24} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16, letterSpacing: 1 }}>POST</Text>
              <Text style={{ color: COLORS.primary, fontSize: 10, fontWeight: 'bold', letterSpacing: 2, marginTop: 2 }}>PREVIEW</Text>
            </View>
            <View style={{ width: 44 }} />
          </LinearGradient>

          <View style={styles.playerContainer}>
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          </View>

          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.95)']} style={styles.modalBottomControls}>
            <TouchableOpacity
              style={[styles.modalDownloadBtn, downloading && { opacity: 0.7, backgroundColor: COLORS.textSecondary }]}
              onPress={() => handleDownloadImage(selectedImage, 0)}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator color="#000" size="small" style={{ marginRight: 10 }} />
              ) : (
                <Download color="#000" size={24} style={{ marginRight: 10 }} />
              )}
              <Text style={styles.modalDownloadText}>
                {downloading ? `SAVING ${Math.round(downloadProgress * 100)}%` : 'SAVE TO VAULT'}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
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
    marginBottom: 30,
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
  resultsSection: {
    marginBottom: 20,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  resultsCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(180, 185, 255, 0.08)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(180, 185, 255, 0.15)',
  },
  resultsCountText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  downloadAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    ...SHADOWS.primary,
  },
  downloadAllText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  imageCard: {
    width: (width - SPACING.lg * 2 - 12) / 2,
    marginBottom: 16,
  },
  imageCardInner: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  imageThumb: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  imageIndex: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  imageSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 8,
    ...SHADOWS.primary,
  },
  imageSaveBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 6,
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerContainer: {
    width: width * 0.9,
    height: height * 0.65,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  modalTopNav: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 100,
  },
  modalBottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 50,
    paddingTop: 80,
    paddingHorizontal: 20,
    zIndex: 100,
    flexDirection: 'column',
  },
  modalCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  modalDownloadBtn: {
    width: '100%',
    height: 60,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.primary,
  },
  modalDownloadText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
