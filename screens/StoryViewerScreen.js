import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator,
  Dimensions,
  Modal,
  Image,
  FlatList,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import { showAlert } from '../utils/alert';
import { useIsFocused } from '@react-navigation/native';
import { 
  ArrowLeft, 
  User, 
  Globe, 
  Shield, 
  Download, 
  Search,
} from 'lucide-react-native';

import { COLORS, RADII, SHADOWS } from '../constants/Theme';
import { fetchStories, fetchReelData } from '../services/api';
import { startBackgroundDownload } from '../services/backgroundDownload';
import { CustomInput } from '../components/CustomInput';
import { ProgressBar } from '../components/ProgressBar';
import { DownloadProgressBar } from '../components/DownloadProgressBar';
import { SkeletonGrid } from '../components/SkeletonLoader';
import VideoPlayer from '../components/VideoPlayer';
import { parseInstagramUrl } from '../utils/urlParser';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 32 - 12) / 2; // (screenWidth - paddingHorizontal*2 - gap) / 2
const STORY_HEIGHT = COLUMN_WIDTH * 1.5;

/**
 * CachedImage — downloads thumbnail to local cache to prevent black screen
 * from expired Instagram CDN URLs.
 * Uses a stable filename derived from the URL hash + an in-memory map,
 * so revisits resolve instantly without re-downloading (and without
 * leaking a new random file into the cache dir on every mount).
 */
const thumbMemoryCache = new Map();

const thumbFileNameFor = (uri) => {
  let hash = 0;
  for (let i = 0; i < uri.length; i++) {
    hash = (hash * 31 + uri.charCodeAt(i)) | 0;
  }
  return `thumb_${(hash >>> 0).toString(36)}.jpg`;
};

const CachedImage = React.memo(({ uri, style, resizeMode = 'cover' }) => {
  const [cachedUri, setCachedUri] = React.useState(() => thumbMemoryCache.get(uri) || null);

  React.useEffect(() => {
    if (!uri) return;
    let cancelled = false;

    const cacheThumbnail = async () => {
      try {
        const fileName = thumbFileNameFor(uri);
        const localPath = FileSystem.cacheDirectory + fileName;
        const info = await FileSystem.getInfoAsync(localPath);
        if (!info.exists) {
          const { uri: localUri } = await FileSystem.downloadAsync(uri, localPath);
          thumbMemoryCache.set(uri, localUri);
          if (!cancelled) setCachedUri(localUri);
        } else {
          thumbMemoryCache.set(uri, localPath);
          if (!cancelled) setCachedUri(localPath);
        }
      } catch (e) {
        if (!cancelled) {
          setCachedUri(uri);
        }
      }
    };

    cacheThumbnail();
    return () => { cancelled = true; };
  }, [uri]);

  if (!cachedUri) {
    return (
      <View style={[style, { backgroundColor: COLORS.surfaceLight, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={COLORS.primary} size="small" />
      </View>
    );
  }

  return (
    <Image 
      source={{ uri: cachedUri }} 
      style={style} 
      resizeMode={resizeMode}
    />
  );
});

const StoryItem = React.memo(({ item, onPress, onDownload, disabled, index, username }) => {
  const scale = React.useRef(new Animated.Value(1)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(16)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: Math.min(index * 40, 300), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: Math.min(index * 40, 300), useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  };

  const displayUsername = username && !username.includes('http') ? username : '';

  return (
    <Animated.View style={[styles.cardItemWrapper, { opacity, transform: [{ scale }, { translateY }] }]}>
      <TouchableOpacity 
        style={styles.storyCard}
        activeOpacity={0.9}
        onPress={() => onPress(item)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
      >
        {/* Media Thumbnail */}
        <View style={styles.thumbWrapper}>
          <CachedImage 
            uri={item.thumbnail || item.url} 
            style={styles.thumbImage} 
            resizeMode="cover"
          />

          {/* Type Badge Top-Left */}
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>
              {item.type?.toUpperCase() === 'VIDEO' ? '▶ VIDEO' : 'PHOTO'}
            </Text>
          </View>

          {/* Duration Top-Right if available */}
          {item.duration && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationBadgeText}>{item.duration}</Text>
            </View>
          )}

          {/* Bottom Gradient overlay */}
          <LinearGradient 
            colors={['transparent', 'rgba(0,0,0,0.85)']} 
            style={styles.bottomGradient} 
          />

          {/* User info at bottom left */}
          <View style={styles.userInfoOverlay}>
            <View style={styles.userAvatarPlaceholder}>
              <Text style={styles.avatarLetter}>
                {displayUsername ? displayUsername.charAt(0).toUpperCase() : 'S'}
              </Text>
            </View>
            <Text style={styles.usernameText} numberOfLines={1}>
              {displayUsername ? `@${displayUsername}` : 'Story'}
            </Text>
          </View>

          {/* Amber Download Button Overlay in bottom-right corner */}
          <TouchableOpacity
            style={styles.cardDownloadOverlay}
            onPress={() => onDownload(item)}
            activeOpacity={0.8}
            disabled={disabled}
          >
            <Download color="#000" size={15} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

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

  // Real debounce: only the latest scheduled auto-fetch runs. User typing
  // cancels any pending share-link fetch so it can't overwrite their input.
  const scheduleAutoFetch = (value) => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => {
      debounceTimeoutRef.current = null;
      handleFetchWithTarget(value);
    }, 500);
  };

  const cancelPendingAutoFetch = () => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
  };

  React.useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      if (fetchIntervalRef.current) clearInterval(fetchIntervalRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (route?.params?.initialUrl) {
      const url = route.params.initialUrl;
      const parsed = parseInstagramUrl(url);

      if (parsed && parsed.type === 'story' && parsed.username) {
        setUsername(parsed.username);
        setDetectedUsername(parsed.username);
        setSearchType('profile');
        scheduleAutoFetch(parsed.username);
      } else {
        setUsername(url);
        setSearchType('link');
        scheduleAutoFetch(url);
      }
    } else if (route?.params?.initialUsername) {
      setUsername(route.params.initialUsername);
      setDetectedUsername(route.params.initialUsername);
      setSearchType('profile');
      scheduleAutoFetch(route.params.initialUsername);
    }
  }, [route?.params?.initialUrl, route?.params?.initialUsername]);

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

    // Throttled fake progress: 1 update/sec (~900ms total) — the old 200ms
    // setState storm was janky and destabilized the visible input/keyboard.
    fetchIntervalRef.current = setInterval(() => {
      setFetchProgress(prev => (prev < 0.9 ? prev + 0.1 : prev));
    }, 1000);

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

      // Smooth settle to 100% then clear — no flicker of the bar.
      setFetchProgress(1);
      setTimeout(() => setFetchProgress(0), 250);
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
      let message = serverData?.message || err.message || "We couldn't get stories for this user. Please try again.";

      if (status === 401) {
        title = serverData?.error || 'Session Expired';
        message = serverData?.message || 'Instagram session expired on our server. Please wait a bit and try again.';
      } else if (status === 403) {
        title = serverData?.error || 'This Account is Private';
        message = serverData?.message || 'This is a private account. You can only view stories from public accounts.';
      } else if (status === 404) {
        title = serverData?.error || 'No Stories Right Now';
        message = serverData?.message || "This user hasn't posted any stories recently, or the username doesn't exist.";
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
    if (result.success) showAlert('Saved!', 'Media saved to your gallery.');
  };

  const handlePaste = async () => {
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
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Toggle Pill Buttons */}
      <View style={styles.toggleRow}>
        <TouchableOpacity 
          style={[styles.togglePill, searchType === 'profile' && styles.togglePillActive]}
          onPress={() => setSearchType('profile')}
        >
          <User color={searchType === 'profile' ? '#000' : COLORS.textSecondary} size={14} />
          <Text style={[styles.toggleText, searchType === 'profile' && styles.toggleTextActive]}>BY USER</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.togglePill, searchType === 'link' && styles.togglePillActive]}
          onPress={() => setSearchType('link')}
        >
          <Globe color={searchType === 'link' ? '#000' : COLORS.textSecondary} size={14} />
          <Text style={[styles.toggleText, searchType === 'link' && styles.toggleTextActive]}>BY LINK</Text>
        </TouchableOpacity>
      </View>

      {/* Hero Area */}
      <View style={styles.heroSection}>
        <Text style={styles.heroTitle}>View Stories{'\n'}Anonymously.</Text>
        <Text style={styles.heroSub}>
          {searchType === 'profile' 
            ? 'Enter any public Instagram username to browse active stories.'
            : 'Paste a direct Instagram story link to view and save.'}
        </Text>
      </View>

      {/* Input Card */}
      <View style={styles.extractionCard}>
        <CustomInput
          placeholder={searchType === 'profile' ? "Enter username (e.g. cristiano)" : "Paste story link"}
          value={username}
          onChangeText={(text) => {
            cancelPendingAutoFetch();
            setUsername(text);
            setError(null);
            if (text.includes('instagram.com') || text.includes('http')) {
              setSearchType('link');
              const parsed = parseInstagramUrl(text);
              if (parsed && parsed.username) setDetectedUsername(parsed.username);
              else setDetectedUsername('');
            } else {
              if (searchType === 'link' && !text.includes('/')) setSearchType('profile');
              setDetectedUsername('');
            }
          }}
          onClear={() => {
            cancelPendingAutoFetch();
            setUsername('');
            setError(null);
            setStories([]);
          }}
          icon={searchType === 'profile' ? User : Globe}
          suffix={() => (
            <TouchableOpacity style={styles.inlinePasteBtn} onPress={handlePaste}>
              <Text style={styles.pasteBubbleText}>Paste</Text>
            </TouchableOpacity>
          )}
        />

        {detectedUsername ? (
          <View style={styles.detectedUserRow}>
            <User color={COLORS.primary} size={13} style={{ marginRight: 4 }} />
            <Text style={styles.detectedUserText}>@{detectedUsername}</Text>
          </View>
        ) : null}

        <TouchableOpacity 
          style={[styles.searchBtn, loading && { opacity: 0.7 }]} 
          onPress={handleFetch}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={styles.searchBtnText}>
              {searchType === 'profile' ? 'SEARCH' : 'EXTRACT STORY'}
            </Text>
          )}
        </TouchableOpacity>

        {loading && (
          <View style={{ marginTop: 14 }}>
            <ProgressBar progress={fetchProgress} label="Fetching Stories..." />
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

      {/* Loading Skeleton Grid */}
      {loading && (
        <View style={{ marginTop: 8 }}>
          <SkeletonGrid count={4} />
        </View>
      )}

      {/* Empty State */}
      {!loading && stories.length === 0 && !error && (
        <View style={styles.emptyContainer}>
          <Search color={COLORS.primary} size={32} opacity={0.6} />
          <Text style={styles.emptyTitle}>No Stories Loaded</Text>
          <Text style={styles.emptySub}>
            Search a public username to view active stories
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Centered Stories Navbar */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft color={COLORS.text} size={22} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Stories</Text>
        <View style={styles.navRightPlaceholder} />
      </View>

      <FlatList
        data={loading ? [] : stories}
        keyExtractor={(item, index) => `${index}-${item.url}`}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        // NOTE: call renderHeader() — passing the function itself as
        // ListHeaderComponent would remount the whole header (including the
        // TextInput) on every keystroke and dismiss the keyboard each time.
        ListHeaderComponent={renderHeader()}
        renderItem={({ item, index }) => (
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
        contentContainerStyle={styles.listContent}
        removeClippedSubviews
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        updateCellsBatchingPeriod={50}
      />

      {/* Modal Preview */}
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
              <ArrowLeft color="#FFF" size={24} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Story Preview</Text>
              <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '600' }}>
                {selectedStory?.type === 'video' ? 'HD VIDEO' : 'PHOTO'}
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </LinearGradient>

          <View style={styles.playerContainer}>
            {selectedStory?.type === 'video' ? (
              <VideoPlayer
                key={selectedStory.url}
                uri={selectedStory.url}
                title={username.includes('http') ? 'Instagram Story' : `@${username}`}
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
              style={[styles.modalDownloadBtn, downloading && { opacity: 0.7 }]}
              onPress={() => handleDownload(selectedStory)}
              disabled={downloading}
              activeOpacity={0.85}
            >
              {downloading ? (
                <ActivityIndicator color="#000" size="small" style={{ marginRight: 8 }} />
              ) : (
                <Download color="#000" size={20} style={{ marginRight: 8 }} />
              )}
              <Text style={styles.modalDownloadText}>
                {downloading ? `SAVING ${downloadProgress?.percent || 0}%` : 'SAVE TO VAULT'}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
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
  navRightPlaceholder: {
    width: 40,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 110, // Content padding bottom 110px
  },
  headerContainer: {
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 14,
    padding: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  togglePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    borderRadius: 11,
    gap: 6,
  },
  togglePillActive: {
    backgroundColor: COLORS.primary,
  },
  toggleText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  toggleTextActive: {
    color: '#000',
  },
  heroSection: {
    marginBottom: 18,
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 26, // 26px fontWeight 900
    fontWeight: '900',
    lineHeight: 32,
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
    marginBottom: 14,
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
  detectedUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -4,
    marginBottom: 10,
    marginLeft: 4,
  },
  detectedUserText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  searchBtn: {
    backgroundColor: COLORS.primary,
    height: 52, // 52px amber
    borderRadius: 50, // radius 50
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    ...SHADOWS.primary,
  },
  searchBtnText: {
    color: '#000',
    fontSize: 15,
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  columnWrapper: {
    gap: 12, // Story grid: 2 columns, gap 12
    justifyContent: 'space-between',
  },
  cardItemWrapper: {
    width: COLUMN_WIDTH,
    marginBottom: 12,
  },
  storyCard: {
    width: COLUMN_WIDTH,
    height: STORY_HEIGHT,
    borderRadius: 20, // StoryItem cards radius 20px
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  thumbWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  typeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  durationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  durationBadgeText: {
    color: COLORS.primary,
    fontSize: 9,
    fontWeight: '700',
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 70,
  },
  userInfoOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userAvatarPlaceholder: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: '#000',
    fontSize: 10,
    fontWeight: '900',
  },
  usernameText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  cardDownloadOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primary, // amber download button overlay in bottom-right corner
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalTopNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 45,
    paddingHorizontal: 16,
    paddingBottom: 20,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenPlayer: {
    width: '100%',
    height: '100%',
  },
  modalBottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 35,
    paddingTop: 30,
  },
  modalProgressContainer: {
    marginBottom: 12,
  },
  modalDownloadBtn: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.primary,
  },
  modalDownloadText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
