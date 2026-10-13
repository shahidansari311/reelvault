import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  Share,
  ScrollView,
  Animated,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { showAlert } from '../utils/alert';
import { shareMediaFile } from '../utils/shareFile';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { 
  ArrowLeft,
  Download, 
  Link2 as LinkIcon, 
  Share2,
  Shield, 
  Video as VideoIcon,
} from 'lucide-react-native';
import { COLORS, RADII, FONTS, SHADOWS } from '../constants/Theme';
import { fetchReelData } from '../services/api';
import { parseInstagramUrl } from '../utils/urlParser';
import { startBackgroundDownload } from '../services/backgroundDownload';
import { CustomInput } from '../components/CustomInput';
import { ProgressBar } from '../components/ProgressBar';
import { DownloadProgressBar } from '../components/DownloadProgressBar';
import VideoPlayer from '../components/VideoPlayer';

const PreviewCard = ({ reelData, downloading, downloadProgress, handleDownload, handleShare, isFocused }) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.96)).current;
  
  React.useEffect(() => {
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.96);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true })
    ]).start();
  }, [reelData]);

  return (
    <Animated.View style={[styles.previewContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      <View style={styles.previewFrame}>
        <VideoPlayer
          key={reelData.videoUrl}
          uri={reelData.videoUrl}
          title={reelData.title || 'Instagram Reel'}
          shouldPlay={isFocused && !downloading}
          isLooping
          aspectRatio={9 / 16}
        />
      </View>

      {downloading && (
        <View style={{ marginBottom: 14 }}>
          <DownloadProgressBar progress={downloadProgress} />
        </View>
      )}

      <View style={styles.metaCard}>
        <View style={styles.metaHeader}>
          <View style={styles.metaIconContainer}>
            <VideoIcon color={COLORS.primary} size={18} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.metaTitle} numberOfLines={1}>{reelData.title || 'Extracted Reel'}</Text>
            <Text style={styles.metaSubtitle}>High-Definition MP4</Text>
          </View>
        </View>
        
        <View style={styles.actionGrid}>
          <TouchableOpacity 
            style={[styles.downloadActionBtn, downloading && { opacity: 0.6 }]}
            onPress={handleDownload}
            disabled={downloading}
            activeOpacity={0.85}
          >
            {downloading ? (
              <ActivityIndicator color="#000" size="small" style={{ marginRight: 8 }} />
            ) : (
              <Download color="#000" size={18} style={{ marginRight: 8 }} />
            )}
            <Text style={styles.downloadActionText}>
              {downloading ? `SAVING ${downloadProgress?.percent || 0}%` : 'DOWNLOAD'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.shareActionBtn, downloading && { opacity: 0.5 }]} 
            onPress={handleShare}
            disabled={downloading}
            activeOpacity={0.8}
          >
            <Share2 color={COLORS.text} size={18} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

export default function ReelDownloaderScreen({ navigation, route }) {
  const isFocused = useIsFocused();

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchProgress, setFetchProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [reelData, setReelData] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  // Tracked auto-fetch timer: cleared on unmount and when the user types,
  // so a stale share-link fetch can't leak or overwrite manual input.
  const autoFetchTimeoutRef = React.useRef(null);
  const clearPendingAutoFetch = () => {
    if (autoFetchTimeoutRef.current) {
      clearTimeout(autoFetchTimeoutRef.current);
      autoFetchTimeoutRef.current = null;
    }
  };
  // In-flight dedup: the same URL sometimes arrives from clipboard
  // auto-fetch + share intent + manual tap at once — one backend hit only.
  const fetchingUrlRef = React.useRef(null);
  useEffect(() => () => clearPendingAutoFetch(), []);

  // Debounced auto-fetch: shared by clipboard auto-paste and share intents.
  // handleFetchUrl is declared below; the timeout fires long after render,
  // so the closure reference is safe.
  const scheduleAutoFetch = (text) => {
    clearPendingAutoFetch();
    autoFetchTimeoutRef.current = setTimeout(() => {
      autoFetchTimeoutRef.current = null;
      handleFetchUrl(text);
    }, 500);
  };

  // Copy a reel link in Instagram, open the app → link is fetched straight away.
  useFocusEffect(
    React.useCallback(() => {
      if (!isFocused) return;
      // Let an explicit share intent / autoPaste win if one is present.
      if (route.params?.initialUrl || route.params?.autoPaste) return;
      if (url) return; // don't stomp on an already-loaded result
      let cancelled = false;
      (async () => {
        try {
          const text = await Clipboard.getStringAsync();
          if (cancelled || !text || !text.includes('instagram.com/')) return;
          setUrl(text);
          setError(null);
          scheduleAutoFetch(text);
        } catch (e) {
          console.warn('clipboard read failed:', e);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [isFocused, route.params?.initialUrl, route.params?.autoPaste, url])
  );

  useEffect(() => {
    if (route.params?.initialUrl) {
      setUrl(route.params.initialUrl);
      clearPendingAutoFetch();
      autoFetchTimeoutRef.current = setTimeout(() => {
        autoFetchTimeoutRef.current = null;
        if (route.params.initialUrl) {
          handleFetchUrl(route.params.initialUrl);
        }
      }, 500);
    } else if (route.params?.autoPaste) {
      handlePaste();
    } else {
      checkClipboard();
    }
    loadHistory();
  }, [route.params?.autoPaste, route.params?.initialUrl]);

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text.includes('instagram.com/')) {
      setUrl(text);
      setError(null);
    }
  };

  const handleFetchUrl = async (urlToFetch) => {
    if (!urlToFetch) return;
    const trimmed = urlToFetch.trim();
    // Drop duplicate in-flight requests for the same URL (clipboard
    // auto-fetch + share intent + tap can all fire together).
    if (fetchingUrlRef.current === trimmed) return;
    fetchingUrlRef.current = trimmed;

    // Profile / story / unknown links contain no downloadable reel — reroute
    // instead of burning all backend extraction methods into a 503.
    const parsed = parseInstagramUrl(trimmed);
    if (parsed?.type === 'profile' && parsed.username) {
      fetchingUrlRef.current = null;
      showAlert(
        'Profile Link',
        `This is @${parsed.username}'s profile, not a reel. Want to view their stories instead?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'View Stories',
            onPress: () => navigation.navigate('Stories', { initialUsername: parsed.username }),
          },
        ]
      );
      return;
    }
    if (parsed?.type === 'story') {
      fetchingUrlRef.current = null;
      navigation.navigate('Stories', { initialUrl: trimmed });
      return;
    }
    if (parsed && parsed.type === 'unknown') {
      fetchingUrlRef.current = null;
      showAlert('Wrong Link', "That doesn't look like a reel or post link. Open a reel in Instagram, tap Share → Copy Link, then paste it here.");
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    setFetchProgress(0);
    setReelData(null);
    setError(null);

    const interval = setInterval(() => {
      setFetchProgress(prev => {
        if (prev >= 0.9) return prev;
        return prev + 0.02;
      });
    }, 200);

    try {
      const data = await fetchReelData(trimmed);
      clearInterval(interval);
      setFetchProgress(1);
      setReelData(data);
      saveToHistory({ ...data, date: new Date().toISOString(), originalUrl: trimmed });
      setLoading(false);
    } catch (err) {
      clearInterval(interval);
      handleFetchError(err);
    } finally {
      fetchingUrlRef.current = null;
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
    handleFetchUrl(url);
  };

  const handleFetchError = (err) => {
    const serverData = err.response?.data;
    const status = err.response?.status;

    let errorTitle = serverData?.error || 'Something Went Wrong';
    let errorMsg = serverData?.message || err.message || 'We couldn\'t get this video. Please check the link and try again.';

    if (status === 401) {
      errorTitle = serverData?.error || 'Session Expired';
      errorMsg = serverData?.message || 'Instagram session expired on our server. Please wait a bit and try again.';
    } else if (status === 403) {
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
  };

  const handleDownload = async () => {
    if (!reelData?.videoUrl) return;
    setDownloading(true);
    setDownloadProgress(null);
    
    const fileName = `ig_reel_${Date.now()}.mp4`;
    
    const result = await startBackgroundDownload(
      reelData.videoUrl, 
      fileName, 
      (progressData) => setDownloadProgress(progressData),
      {
        title: reelData.title || 'Instagram Reel',
        platform: 'instagram',
        format: 'MP4 Video'
      }
    );
    
    if (result.success) {
      showAlert('Saved!', 'Video saved to your gallery.');
    }
    setDownloading(false);
    setDownloadProgress(null);
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

  const handleShareFile = async () => {
    await shareMediaFile(reelData?.videoUrl, reelData?.title || 'Instagram Reel');
  };

  return (
    <View style={styles.container}>
      {/* Simple Navbar: Back arrow + Instagram Reels title */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft color={COLORS.text} size={22} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Instagram Reels</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Download Reels.</Text>
          <Text style={styles.heroSub}>
            Paste any Instagram Reel link below to extract and save.
          </Text>
        </View>

        {/* Extraction Card */}
        <View style={styles.extractionCard}>
          <CustomInput
            placeholder="Paste Instagram Reel link"
            value={url}
            onChangeText={(text) => {
              clearPendingAutoFetch();
              setUrl(text);
              setError(null);
            }}
            onClear={() => {
              clearPendingAutoFetch();
              setUrl('');
            }}
            icon={LinkIcon}
            suffix={() => (
              <TouchableOpacity style={styles.inlinePasteBtn} onPress={handlePaste}>
                <Text style={styles.pasteBubbleText}>Paste</Text>
              </TouchableOpacity>
            )}
          />
          
          <TouchableOpacity 
            style={[styles.extractBtn, loading && { opacity: 0.7 }]} 
            onPress={handleFetch}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.extractBtnText}>EXTRACT</Text>
            )}
          </TouchableOpacity>

          {loading && (
            <View style={{ marginTop: 14 }}>
              <ProgressBar progress={fetchProgress} label="Extracting Reel..." />
            </View>
          )}

          {error && (
            <View style={styles.errorCard}>
              <View style={styles.errorIconHeader}>
                <Shield color={COLORS.primary} size={16} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
  },
  navTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 110, // Content padding bottom 110px
  },
  heroSection: {
    marginTop: 12,
    marginBottom: 20,
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18,
  },
  extractionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  inlinePasteBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pasteBubbleText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '700',
  },
  extractBtn: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: 50,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.primary,
  },
  extractBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  errorCard: {
    backgroundColor: COLORS.amberGlass,
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.amberBorder,
  },
  errorIconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  errorTitle: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  errorBody: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  previewContainer: {
    marginTop: 6,
    marginBottom: 16,
  },
  previewFrame: {
    width: '100%',
    aspectRatio: 9 / 16, // NOT square, 9/16
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metaCard: {
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  metaIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.amberGlass,
    borderWidth: 1,
    borderColor: COLORS.amberBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  metaTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  metaSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  actionGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  downloadActionBtn: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: 50,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.primary,
  },
  downloadActionText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  shareActionBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});
