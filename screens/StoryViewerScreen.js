import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
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
import { Video } from 'expo-av';
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
} from 'lucide-react-native';
import { COLORS, SPACING, SHADOWS } from '../constants/Theme';
import { fetchStories, fetchReelData } from '../services/api';
import { downloadFile } from '../utils/download';
import { CustomInput } from '../components/CustomInput';
import { ProgressBar } from '../components/ProgressBar';

const { width, height } = Dimensions.get('window');

const StoryItem = React.memo(({ item, onPress, disabled, index }) => {
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

  return (
    <Animated.View style={{ opacity, transform: [{ scale }, { translateY }] }}>
      <TouchableOpacity 
        style={styles.storyPreviewCard}
        onPress={() => onPress(item)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={1}
      >
        {item.type === 'video' ? (
          <View style={styles.videoPreviewContainer}>
            <Image 
              source={{ uri: item.thumbnail || item.url }} 
              style={styles.storyThumb} 
              resizeMode="cover"
            />
            <View style={styles.playOverlay}>
              <Play color={COLORS.primary} size={32} />
            </View>
          </View>
        ) : (
          <Image 
            source={{ uri: item.url }} 
            style={styles.storyThumb} 
            resizeMode="cover"
          />
        )}
        <View style={styles.typeBadge}>
          {item.type === 'video' ? (
            <Play color="#FFF" size={10} style={{ marginRight: 4 }} />
          ) : (
            <Eye color="#FFF" size={10} style={{ marginRight: 4 }} />
          )}
          <Text style={styles.typeText}>{item.type.toUpperCase()}</Text>
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
    <Animated.View style={[styles.storyPreviewCard, { opacity, backgroundColor: 'rgba(255,255,255,0.08)' }]} />
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

export default function StoryViewerScreen({ navigation }) {
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



  const handleFetch = async () => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    if (!username) return;

    const currentFetchId = ++fetchIdRef.current;

    if (fetchIntervalRef.current) {
      clearInterval(fetchIntervalRef.current);
      fetchIntervalRef.current = null;
    }

    setLoading(true);
    setFetchProgress(0);
    setError(null);
    setStories([]);

    let target = username.trim();
    let isReel = false;
    
    if (target.includes('instagram.com/')) {
      if (target.includes('/reel/') || target.includes('/reels/') || target.includes('/p/')) {
        isReel = true;
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

    // Smooth simulated progress (2% increments)
    fetchIntervalRef.current = setInterval(() => {
      setFetchProgress(prev => (prev < 0.9 ? prev + 0.02 : prev));
    }, 200);

    try {
      let results = [];
      if (isReel) {
        const data = await fetchReelData(username.trim());
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


  const handleDownload = async (item) => {
    if (!item) return;
    setDownloading(true);
    setDownloadProgress(0);
    const fileName = `story_${Date.now()}.${item.type === 'video' ? 'mp4' : 'jpg'}`;
    const success = await downloadFile(
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
    setDownloadProgress(0);
    if (success) Alert.alert('Saved!', 'Media saved to your gallery.');
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
        <CustomInput
          placeholder={searchType === 'profile' ? "beingrimi_, cristiano..." : "Paste Instagram Story Link"}
          value={username}
          onChangeText={(text) => {
            setUsername(text);
            setError(null);
            const cleanText = text.trim();
            if (cleanText.includes('instagram.com') || cleanText.includes('http')) {
              if (searchType !== 'link') setSearchType('link');
            } else if (cleanText.length > 0 && !cleanText.includes('/') && !cleanText.includes(' ')) {
              if (searchType !== 'profile') setSearchType('profile');
            }
          }}
          onClear={() => {
            setUsername('');
            setError(null);
          }}
          icon={searchType === 'profile' ? User : Globe}
          suffix={() => (
            <TouchableOpacity 
              style={styles.inlinePasteBtn} 
              onPress={async () => {
                const text = await Clipboard.getStringAsync();
                const cleanText = text.trim();
                setUsername(cleanText);
                setError(null);
                if (cleanText.includes('instagram.com') || cleanText.includes('http')) {
                  setSearchType('link');
                } else if (cleanText.length > 0 && !cleanText.includes('/') && !cleanText.includes(' ')) {
                  setSearchType('profile');
                }
              }}
            >
              <Text style={styles.pasteBubbleText}>Paste</Text>
            </TouchableOpacity>
          )}
        />
        
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

  const renderEmpty = () => !loading && (
    <View style={styles.emptyContainer}>
      <TrendingUp color={COLORS.textSecondary} size={40} style={{ opacity: 0.3 }} />
      <Text style={styles.emptyText}>History remains silent. Start your first extraction.</Text>
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
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        renderItem={({ item, index }) => (
          loading ? <SkeletonItem index={index} /> :
          <StoryItem 
            item={item} 
            index={index}
            onPress={setSelectedStory} 
            disabled={downloading} 
          />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 150 }}
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
              <Video
                key={selectedStory.url} // Force fresh play instance
                source={{ uri: selectedStory.url }}
                rate={1.0}
                volume={1.0}
                isMuted={false}
                resizeMode="contain"
                shouldPlay={isFocused && !!selectedStory && !downloading}
                isLooping
                useNativeControls={!downloading}
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
                <ProgressBar progress={downloadProgress} label="Saving to Vault" />
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
  storyPreviewCard: {
    width: (width - SPACING.lg * 2 - 15) / 2,
    aspectRatio: 9 / 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  storyThumb: {
    width: '100%',
    height: '100%',
  },
  videoPreviewContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  typeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1,
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
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
  },
});


