import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput,
  TouchableOpacity, 
  ActivityIndicator,
  Dimensions,
  Alert,
  Modal,
  Image,
  FlatList,
  Animated,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import VideoPlayer from '../components/VideoPlayer';
import { useIsFocused } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { 
  ArrowLeft, 
  User, 
  Globe, 
  Shield, 
  Download, 
  Play, 
  TrendingUp,
  Eye,
  Trash2,
} from 'lucide-react-native';
import { COLORS, SPACING, SHADOWS } from '../constants/Theme';
import { fetchStories, fetchReelData } from '../services/api';
import { startBackgroundDownload } from '../services/backgroundDownload';
import { ProgressBar } from '../components/ProgressBar';
import { DownloadProgressBar } from '../components/DownloadProgressBar';
import { parseInstagramUrl, extractUrlFromText } from '../utils/urlParser';

const { width, height } = Dimensions.get('window');

/**
 * CachedImage — downloads thumbnail to local cache to prevent black screen
 * from expired Instagram CDN URLs.
 */
const CachedImage = React.memo(({ uri, style, resizeMode = 'cover' }) => {
  const [cachedUri, setCachedUri] = React.useState(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (!uri) return;
    let cancelled = false;

    const cacheThumbnail = async () => {
      try {
        const fileName = 'thumb_' + Math.random().toString(36).slice(2) + '.jpg';
        const localPath = FileSystem.cacheDirectory + fileName;
        const { uri: localUri } = await FileSystem.downloadAsync(uri, localPath);
        if (!cancelled) setCachedUri(localUri);
      } catch (e) {
        if (!cancelled) {
          // Fall back to original URI if cache fails
          setCachedUri(uri);
        }
      }
    };

    cacheThumbnail();
    return () => { cancelled = true; };
  }, [uri]);

  if (!cachedUri) {
    return (
      <View style={[style, { backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={COLORS.primary} size="small" />
      </View>
    );
  }

  return (
    <Image 
      source={{ uri: cachedUri }} 
      style={style} 
      resizeMode={resizeMode}
      onError={() => setError(true)}
    />
  );
});

const CARD_WIDTH = (width - SPACING.lg * 2 - 15) / 2;
const STORY_CARD_HEIGHT = CARD_WIDTH * (16 / 9) * 1.2;

const StoryItem = React.memo(({ item, onPress, onDownload, disabled, index, username }) => {
  const scale = React.useRef(new Animated.Value(1)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(20)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay: index * 50, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 400, delay: index * 50, useNativeDriver: true }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  };

  const displayUsername = detectedUsername || (username.includes('http') ? '' : username);

  return (
    <Animated.View style={{ opacity, transform: [{ scale }, { translateY }], marginBottom: 16 }}>
      <TouchableOpacity 
        style={[styles.card, { marginBottom: 0 }]}
        activeOpacity={0.9}
        onPress={() => onPress(item)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
      >
        {/* Thumbnail */}
        <View style={styles.thumbContainer}>
          <CachedImage 
            uri={item.thumbnail || item.url} 
            style={styles.thumb} 
            resizeMode="contain"
          />
          
          {/* VIDEO badge top right */}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>▷ {item.type?.toUpperCase() || 'VIDEO'}</Text>
          </View>

          {/* Duration bottom right */}
          {item.duration && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{item.duration}</Text>
            </View>
          )}

          {/* Dark gradient overlay at bottom */}
          <LinearGradient colors={['transparent', '#00000099']} style={styles.gradient} />
        </View>

        {/* Card bottom info */}
        <View style={styles.cardInfo}>
          {/* Username row */}
          <View style={styles.userRow}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {displayUsername ? displayUsername.charAt(0).toUpperCase() : '👤'}
              </Text>
            </View>
            <Text style={styles.username} numberOfLines={1}>
              {displayUsername ? `@${displayUsername}` : 'Story'}
            </Text>
          </View>

          {/* Download button */}
          <TouchableOpacity
            style={styles.downloadBtn}
            onPress={() => onDownload(item)}
            activeOpacity={0.8}
            disabled={disabled}
          >
            <Text style={styles.downloadBtnText}>⬇ Download</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const SkeletonItem = ({ index }) => {
  const opacity = React.useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true })
      ])
    );
    const timeout = setTimeout(() => animation.start(), index * 100);
    return () => {
      clearTimeout(timeout);
      animation.stop();
    };
  }, []);

  return (
    <Animated.View style={[styles.card, { opacity, backgroundColor: 'rgba(255,255,255,0.08)', height: STORY_CARD_HEIGHT + 80 }]} />
  );
};

const AnimatedErrorBubble = ({ error }) => {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(-20)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, friction: 6, useNativeDriver: true })
    ]).start();
  }, [error]);

  return (
    <Animated.View style={[styles.errorBubble, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.errorIconHeader}>
        <Shield color="#FF6B6B" size={18} />
        <Text style={styles.errorTitle}>{error.title}</Text>
      </View>
      <Text style={styles.errorBody}>{error.message}</Text>
    </Animated.View>
  );
};

export default function StoryViewerScreen({ navigation, route }) {
  const isFocused = useIsFocused();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchProgress, setFetchProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [stories, setStories] = useState([]);
  const [error, setError] = useState(null);
  const [searchType, setSearchType] = useState('profile'); // 'profile' or 'link'
  const [selectedStory, setSelectedStory] = useState(null);
  const [detectedUsername, setDetectedUsername] = useState('');

  const debounceTimeoutRef = React.useRef(null);
  const fetchIdRef = React.useRef(0);
  const fetchIntervalRef = React.useRef(null);

  // Clean up intervals on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      if (fetchIntervalRef.current) clearInterval(fetchIntervalRef.current);
    };
  }, []);

  // Handle share intent: auto-fill username/URL when opened via share
  React.useEffect(() => {
    if (route?.params?.initialUrl) {
      const url = route.params.initialUrl;
      const parsed = parseInstagramUrl(url);

      if (parsed && parsed.type === 'story' && parsed.username) {
        // Story URL — auto-fill username and auto-fetch
        setUsername(parsed.username);
        setDetectedUsername(parsed.username);
        setSearchType('profile');
        setTimeout(() => handleFetchWithTarget(parsed.username), 500);
      } else {
        // Other IG URL — put in input as link
        setUsername(url);
        setSearchType('link');
        setTimeout(() => handleFetchWithTarget(url), 500);
      }
    } else if (route?.params?.initialUsername) {
      setUsername(route.params.initialUsername);
      setDetectedUsername(route.params.initialUsername);
      setSearchType('profile');
      setTimeout(() => handleFetchWithTarget(route.params.initialUsername), 500);
    }
  }, [route?.params?.initialUrl, route?.params?.initialUsername]);


  // Reusable fetch function that accepts a target parameter (for share intent auto-fetch)
  const handleFetchWithTarget = async (targetInput) => {
    if (!targetInput) return;

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    const currentFetchId = ++fetchIdRef.current;

    if (fetchIntervalRef.current) {
      clearInterval(fetchIntervalRef.current);
      fetchIntervalRef.current = null;
    }

    setLoading(true);
    setFetchProgress(0);
    setError(null);
    setStories([]);

    let target = (targetInput || '').trim();
    let isReel = false;
    
    if (target.includes('instagram.com/')) {
      // Auto-parse the URL to extract username or detect reel/post
      const parsed = parseInstagramUrl(target);

      if (parsed.type === 'reel' || parsed.type === 'post') {
        isReel = true;
      } else if (parsed.type === 'story' && parsed.username) {
        target = parsed.username;
        setDetectedUsername(parsed.username);
      } else if (parsed.type === 'profile' && parsed.username) {
        target = parsed.username;
        setDetectedUsername(parsed.username);
      } else {
        // Fallback: extract username from URL path
        const parts = target.split('/');
        const storyIndex = parts.indexOf('stories');
        if (storyIndex !== -1 && parts[storyIndex + 1]) {
          target = parts[storyIndex + 1];
        } else {
          target = target.split('?')[0].split('/').filter(p => p.length > 0).pop();
        }
      }
    }
    
    target = target.replace('@', '').split('?')[0];

    // Smooth simulated progress (2% increments)
    fetchIntervalRef.current = setInterval(() => {
      setFetchProgress(prev => (prev < 0.9 ? prev + 0.02 : prev));
    }, 200);

    try {
      let results = [];
      if (isReel) {
        const data = await fetchReelData((targetInput || '').trim());
        results = [{
          type: 'video',
          url: data.videoUrl,
          thumbnail: data.videoUrl,
          title: data.title
        }];
      } else {
        const data = await fetchStories(target);
        if (data && data.length > 0) {
          results = data;
        } else {
          throw new Error('No stories found for this user right now.');
        }
      }

      if (currentFetchId !== fetchIdRef.current) return;

      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current);
        fetchIntervalRef.current = null;
      }

      setFetchProgress(1);
      if (currentFetchId !== fetchIdRef.current) return;
      setStories(results);
      setLoading(false);

    } catch (err) {
      if (currentFetchId !== fetchIdRef.current) return;

      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current);
        fetchIntervalRef.current = null;
      }

      const serverData = err.response?.data;
      const status = err.response?.status;

      let title = serverData?.error || 'Something Went Wrong';
      let message = serverData?.message || err.message || 'We couldn\'t get stories for this user. Please try again.';

      if (status === 403) {
        title = serverData?.error || 'This Account is Private';
        message = serverData?.message || 'This is a private account. You can only view stories from public accounts.';
      } else if (status === 404) {
        title = serverData?.error || 'No Stories Right Now';
        message = serverData?.message || 'This user hasn\'t posted any stories recently, or the username doesn\'t exist.';
      } else if (status === 429) {
        title = serverData?.error || 'Too Many Requests';
        message = serverData?.message || 'Instagram is limiting our access right now. Please wait a minute and try again.';
      } else if (status === 504) {
        title = serverData?.error || 'Taking Too Long';
        message = serverData?.message || 'The request took too long. Please try again.';
      } else if (!err.response) {
        title = 'No Internet';
        message = 'Could not connect to the server. Please check your internet connection.';
      }

      setError({ title, message });
      setLoading(false);
    }
  };

  const handleFetch = async () => {
    handleFetchWithTarget(username);
  };

  const handleDownload = async (item) => {
    if (!item) return;
    setDownloading(true);
    setDownloadProgress(null);
    const fileName = `story_${Date.now()}.${item.type === 'video' ? 'mp4' : 'jpg'}`;
    const result = await startBackgroundDownload(
      item.url, 
      fileName, 
      (p) => setDownloadProgress(p),
      {
        title: item.title || `Instagram Story (${username})`,
        platform: 'instagram',
        format: item.type === 'video' ? 'MP4 Video' : 'JPG Image'
      }
    );
    setDownloading(false);
    setDownloadProgress(null);
    if (result.success) Alert.alert('Saved!', 'Media saved to your gallery.');
  };

  const renderHeader = () => (
    <>
      <View style={styles.toggleGrid}>
        <TouchableOpacity 
          style={[styles.toggleBtn, searchType === 'profile' && styles.toggleBtnActive]}
          onPress={() => setSearchType('profile')}
        >
          <User color={searchType === 'profile' ? '#000' : COLORS.textSecondary} size={18} />
          <Text style={[styles.toggleText, searchType === 'profile' && styles.toggleTextActive]}>BY USER</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.toggleBtn, searchType === 'link' && styles.toggleBtnActive]}
          onPress={() => setSearchType('link')}
        >
          <Globe color={searchType === 'link' ? '#000' : COLORS.textSecondary} size={18} />
          <Text style={[styles.toggleText, searchType === 'link' && styles.toggleTextActive]}>BY LINK</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.heroSection}>
        <Text style={styles.heroTitle}>
          {searchType === 'profile' ? 'Profile Search' : 'Link Resolver'}
        </Text>
        <Text style={styles.heroSub}>
          {searchType === 'profile' 
            ? 'Enter any public username to curate active stories into your archive.'
            : 'Paste a direct story link to resolve and download high-fidelity media.'}
        </Text>
      </View>

      <View style={styles.extractionCard}>
        <View style={styles.inputRow}>
          <User color={COLORS.textSecondary} size={18} style={{ marginRight: 12 }} />
          <TextInput
            style={styles.rawInput}
            placeholder={searchType === 'profile' ? "beingrimi_, cristiano..." : "Paste Instagram Story Link"}
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={username}
            onChangeText={(text) => {
              setUsername(text);
              setError(null);
              // Auto-detect URL vs username
              if (text.includes('instagram.com') || text.includes('http')) {
                setSearchType('link');
                const parsed = parseInstagramUrl(text);
                if (parsed && parsed.username) {
                  setDetectedUsername(parsed.username);
                } else {
                  setDetectedUsername('');
                }
              } else {
                if (searchType === 'link' && !text.includes('/')) {
                  setSearchType('profile');
                }
                setDetectedUsername('');
              }
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {username.length > 0 && (
              <TouchableOpacity onPress={() => { setUsername(''); setError(null); setStories([]); }} style={{ marginRight: 12 }}>
                <Trash2 color={COLORS.textSecondary} size={18} />
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={styles.inlinePasteBtn} 
              onPress={async () => {
                const text = await Clipboard.getStringAsync();
                const cleanText = text.trim();
                setUsername(cleanText);
                setError(null);
                if (cleanText.includes('instagram.com') || cleanText.includes('http')) {
                  setSearchType('link');
                  const parsed = parseInstagramUrl(cleanText);
                  if (parsed && parsed.username) {
                    setDetectedUsername(parsed.username);
                  } else {
                    setDetectedUsername('');
                  }
                } else {
                  setSearchType('profile');
                  setDetectedUsername('');
                }
              }}
            >
              <Text style={styles.pasteBubbleText}>Paste</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {detectedUsername ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: -10, marginLeft: 10 }}>
            <User color={COLORS.primary} size={14} style={{ marginRight: 6 }} />
            <Text style={{ color: COLORS.primary, fontSize: 13, fontWeight: 'bold' }}>@{detectedUsername}</Text>
          </View>
        ) : null}

        <TouchableOpacity 
          style={[styles.fetchBtn, loading && { opacity: 0.7 }]} 
          onPress={handleFetch}
          disabled={loading}
        >
          <Text style={styles.fetchBtnText}>
            {loading ? 'EXTRACTING...' : (searchType === 'profile' ? 'GET STORIES' : 'EXTRACT MEDIA')}
          </Text>
        </TouchableOpacity>

        {loading && (
          <View style={{ marginTop: 20 }}>
            <ProgressBar progress={fetchProgress} label="Extracting Data" />
          </View>
        )}

        
        {error && <AnimatedErrorBubble error={error} />}

        <Text style={styles.privacyNote}>
          * Archive integrity is maintained. Private profiles remain restricted.
        </Text>
      </View>
    </>
  );

  const renderEmpty = () => !loading && stories.length === 0 && (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>📭</Text>
      <Text style={styles.emptyText}>No stories found</Text>
      <Text style={styles.emptySubText}>
        Enter an Instagram username above to load stories
      </Text>
    </View>
  );

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
      <View style={styles.navbar}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft color={COLORS.text} size={24} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Shield color={COLORS.primary} size={18} style={{ marginRight: 8 }} />
          <Text style={styles.navTitle}>SAVEX</Text>
        </View>
      </View>

      <FlatList
        data={loading ? [1,2,3,4,5,6] : stories}
        keyExtractor={(item, index) => loading ? `skeleton-${index}` : `${index}-${item.url}`}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        ListHeaderComponent={
          <View style={{ marginBottom: 'auto' }}>
            {renderHeader()}
            {renderEmpty()}
          </View>
        }
        renderItem={({ item, index }) => (
          loading ? <SkeletonItem index={index} /> :
          <StoryItem 
            item={item} 
            index={index}
            username={username}
            onPress={setSelectedStory} 
            onDownload={handleDownload}
            disabled={downloading} 
          />
        )}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 150, flexGrow: 1 }}
      />



      <Modal
        visible={!!selectedStory}
        transparent={true}
        animationType="fade"
        onRequestClose={() => !downloading && setSelectedStory(null)}
      >
        <View style={styles.modalBackdrop}>
          <LinearGradient colors={['rgba(0,0,0,0.9)', 'transparent']} style={styles.modalTopNav}>
            <TouchableOpacity 
              style={[styles.modalCloseBtn, downloading && { opacity: 0.5 }]}
              onPress={() => !downloading && setSelectedStory(null)}
              disabled={downloading}
            >
              <ArrowLeft color="#FFF" size={26} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16, letterSpacing: 1 }}>STORY</Text>
              <Text style={{ color: COLORS.primary, fontSize: 10, fontWeight: 'bold', letterSpacing: 2, marginTop: 2 }}>PREVIEW</Text>
            </View>
            <View style={{ width: 44 }} />
          </LinearGradient>

          <View style={styles.playerContainer}>
            {selectedStory?.type === 'video' ? (
              <VideoPlayer
                key={selectedStory.url}
                uri={selectedStory.url}
                title={`Story by ${username}`}
                shouldPlay={isFocused && !!selectedStory && !downloading}
                isLooping
                aspectRatio={undefined}
                style={styles.fullScreenPlayer}
              />
            ) : (
              <Image 
                source={{ uri: selectedStory?.url }} 
                style={styles.fullScreenPlayer}
                resizeMode="contain"
              />
            )}

          </View>

          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.95)']} style={styles.modalBottomControls}>
            {downloading && (
              <View style={styles.modalProgressContainer}>
                <DownloadProgressBar progress={downloadProgress} />
              </View>
            )}

            <TouchableOpacity 
              style={[styles.modalDownloadBtn, downloading && { opacity: 0.7, backgroundColor: COLORS.textSecondary }]}
              onPress={() => handleDownload(selectedStory)}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator color="#000" size="small" style={{ marginRight: 10 }} />
              ) : (
                <Download color="#000" size={24} style={{ marginRight: 10 }} />
              )}
              <Text style={styles.modalDownloadText}>
                {downloading ? `SAVING ${downloadProgress?.percent || 0}%` : 'SAVE TO VAULT'}
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
    paddingHorizontal: SPACING.lg,
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 100,
    paddingTop: 50,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  navTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  toggleGrid: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    padding: 6,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 14,
  },
  toggleBtnActive: {
    backgroundColor: COLORS.primary,
    ...SHADOWS.primary,
  },
  toggleText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 8,
    letterSpacing: 1.5,
  },
  toggleTextActive: {
    color: '#000',
  },
  heroSection: {
    marginTop: 32,
    marginBottom: 32,
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 34,
    fontWeight: '900',
  },
  heroSub: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
    opacity: 0.8,
  },
  extractionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    ...SHADOWS.glass,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 60,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...SHADOWS.glass,
  },
  rawInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    height: '100%',
  },
  inlinePasteBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
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
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    ...SHADOWS.primary,
  },
  fetchBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
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
  privacyNote: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 15,
    fontStyle: 'italic',
  },
  storyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 40,
  },
  // Card Styles
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#12122a',
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    marginBottom: 16,
  },
  thumbContainer: {
    width: '100%',
    height: STORY_CARD_HEIGHT,
    backgroundColor: '#000',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#000000aa',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#000000bb',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    zIndex: 2,
  },
  durationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
  },
  cardInfo: {
    padding: 10,
    gap: 8,
    backgroundColor: '#12122a',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarPlaceholder: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  avatarText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '700',
  },
  username: {
    color: '#ccc',
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  downloadBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  downloadBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeArea: {
    ...StyleSheet.absoluteFillObject,
  },
  playerContainer: {
    width: width * 0.9,
    height: height * 0.8,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  fullScreenPlayer: {
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
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 10,
    letterSpacing: 1,
  },
  modalProgressContainer: {
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 15,
  },
  // Empty state
  empty: {
    flex: 1,
    alignItems: 'center',
    marginTop: 80,
    gap: 8,
  },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  emptySubText: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  storiesContainer: {
    width: '100%',
    flex: 1,
    marginTop: 'auto',
    marginBottom: 20,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
  },
});


