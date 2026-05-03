import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Animated,
  PanResponder,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Maximize2,
  Minimize2,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SEEK_STEP = 10; // seconds
const CONTROLS_TIMEOUT = 4000; // auto-hide after 4s
const SLIDER_HEIGHT = 36;

/**
 * Premium dark video player with custom controls overlay.
 * Uses expo-av Video under the hood — no extra packages needed.
 *
 * Props:
 *  - uri          (string)  — Video source URL
 *  - title        (string)  — Displayed title
 *  - shouldPlay   (bool)    — Auto-play on mount (default: true)
 *  - isLooping    (bool)    — Loop playback (default: true)
 *  - aspectRatio  (number)  — Container aspect ratio (default: 16/9)
 *  - onFullscreenChange (fn) — Called when fullscreen toggles
 *  - style        (object)  — Additional container styles
 *  - accentColor  (string)  — Accent color for controls (default: '#B4B9FF')
 */
export default function VideoPlayer({
  uri,
  title,
  shouldPlay = true,
  isLooping = true,
  aspectRatio = 16 / 9,
  onFullscreenChange,
  style,
  accentColor = '#B4B9FF',
}) {
  const videoRef = useRef(null);
  const controlsTimeout = useRef(null);
  const sliderRef = useRef(null);

  const [status, setStatus] = useState({});
  const [showControls, setShowControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [videoNaturalSize, setVideoNaturalSize] = useState(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);
  const [sliderWidth, setSliderWidth] = useState(SCREEN_WIDTH - 120);

  // Animations
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const centerIconScale = useRef(new Animated.Value(0)).current;
  const centerIconOpacity = useRef(new Animated.Value(0)).current;

  // Derived state
  const isPlaying = status.isPlaying || false;
  const isBuffering = status.isBuffering || false;
  const isLoaded = status.isLoaded || false;
  const currentTime = isSeeking ? seekPosition : (status.positionMillis || 0) / 1000;
  const duration = (status.durationMillis || 0) / 1000;
  const progress = duration > 0 ? currentTime / duration : 0;
  const isMuted = status.isMuted || false;
  const didFinish = status.didJustFinish || false;

  const isPortrait = videoNaturalSize
    ? videoNaturalSize.height > videoNaturalSize.width
    : true; // Default to true (portrait) for social media content

  // ─── Controls Visibility ───────────────────────────────────────
  const resetControlsTimer = useCallback(() => {
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    if (isPlaying && !isSeeking) {
      controlsTimeout.current = setTimeout(() => {
        hideControls();
      }, CONTROLS_TIMEOUT);
    }
  }, [isPlaying, isSeeking]);

  const showControlsAnimated = useCallback(() => {
    setShowControls(true);
    Animated.timing(controlsOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
    resetControlsTimer();
  }, [resetControlsTimer]);

  const hideControls = useCallback(() => {
    Animated.timing(controlsOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setShowControls(false));
  }, []);

  const toggleControls = useCallback(() => {
    if (showControls) {
      hideControls();
    } else {
      showControlsAnimated();
    }
  }, [showControls, hideControls, showControlsAnimated]);

  useEffect(() => {
    if (isPlaying && showControls) {
      resetControlsTimer();
    }
    return () => {
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    };
  }, [isPlaying, showControls, resetControlsTimer]);

  // ─── Playback Actions ──────────────────────────────────────────
  const flashCenterIcon = () => {
    centerIconScale.setValue(0.5);
    centerIconOpacity.setValue(1);
    Animated.parallel([
      Animated.spring(centerIconScale, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(centerIconOpacity, {
        toValue: 0,
        duration: 600,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const togglePlayPause = async () => {
    if (!videoRef.current || !isLoaded) return;
    if (didFinish && !isLooping) {
      await videoRef.current.replayAsync();
    } else if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
    flashCenterIcon();
    resetControlsTimer();
  };

  const seekBy = async (seconds) => {
    if (!videoRef.current || !isLoaded) return;
    const newPos = Math.max(0, Math.min(duration, currentTime + seconds)) * 1000;
    await videoRef.current.setPositionAsync(newPos);
    showControlsAnimated();
  };

  const seekTo = async (seconds) => {
    if (!videoRef.current || !isLoaded) return;
    setIsSeeking(false);
    await videoRef.current.setPositionAsync(seconds * 1000);
    resetControlsTimer();
  };

  const toggleMute = async () => {
    if (!videoRef.current || !isLoaded) return;
    await videoRef.current.setIsMutedAsync(!isMuted);
  };

  const replay = async () => {
    if (!videoRef.current || !isLoaded) return;
    await videoRef.current.setPositionAsync(0);
    await videoRef.current.playAsync();
    showControlsAnimated();
  };

  const toggleFullscreen = () => {
    setFullscreen(!fullscreen);
    if (onFullscreenChange) onFullscreenChange(!fullscreen);
  };

  // ─── Slider Pan Responder ──────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setIsSeeking(true);
        if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
        const locationX = evt.nativeEvent.locationX;
        const pct = Math.max(0, Math.min(1, locationX / sliderWidth));
        setSeekPosition(pct * duration);
      },
      onPanResponderMove: (evt, gestureState) => {
        const startX = gestureState.x0;
        const currentX = gestureState.moveX;
        // Calculate relative to slider bounds
        const sliderStartX = startX - (evt.nativeEvent.locationX || 0);
        const relativeX = currentX - sliderStartX;
        const pct = Math.max(0, Math.min(1, relativeX / sliderWidth));
        setSeekPosition(pct * duration);
      },
      onPanResponderRelease: () => {
        seekTo(seekPosition);
      },
      onPanResponderTerminate: () => {
        setIsSeeking(false);
      },
    })
  ).current;

  // ─── Time Formatting ───────────────────────────────────────────
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // ─── Render ────────────────────────────────────────────────────
  const containerStyle = fullscreen
    ? styles.fullscreenContainer
    : [styles.container, { aspectRatio }, style];

  return (
    <View style={containerStyle}>
      {fullscreen && <StatusBar hidden />}

      {/* Video Layer */}
      <TouchableWithoutFeedback onPress={toggleControls}>
        <View style={styles.videoLayer}>
          <Video
            ref={videoRef}
            source={{ uri }}
            style={styles.video}
            resizeMode={fullscreen ? ResizeMode.CONTAIN : (isPortrait ? ResizeMode.CONTAIN : ResizeMode.COVER)}
            shouldPlay={shouldPlay}
            isLooping={isLooping}
            isMuted={false}
            onPlaybackStatusUpdate={(s) => setStatus(s)}
            onReadyForDisplay={(data) => {
              if (data.naturalSize) {
                setVideoNaturalSize(data.naturalSize);
              }
            }}
          />
        </View>
      </TouchableWithoutFeedback>

      {/* Buffering Spinner (always visible when buffering) */}
      {isBuffering && isLoaded && (
        <View style={styles.bufferingOverlay}>
          <ActivityIndicator size="large" color={accentColor} />
        </View>
      )}

      {/* Initial Loading */}
      {!isLoaded && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={accentColor} />
          <Text style={styles.loadingText}>Loading video...</Text>
        </View>
      )}

      {/* Center Flash Icon (play/pause feedback) */}
      <Animated.View
        style={[
          styles.centerFlash,
          {
            opacity: centerIconOpacity,
            transform: [{ scale: centerIconScale }],
          },
        ]}
        pointerEvents="none"
      >
        <View style={[styles.centerFlashCircle, { backgroundColor: `${accentColor}22` }]}>
          {isPlaying ? (
            <Pause color="#FFF" size={32} fill="#FFF" />
          ) : (
            <Play color="#FFF" size={32} fill="#FFF" />
          )}
        </View>
      </Animated.View>

      {/* Controls Overlay */}
      {showControls && (
        <Animated.View style={[styles.controlsOverlay, { opacity: controlsOpacity }]}>
          {/* Top Gradient + Title */}
          <LinearGradient
            colors={['rgba(0,0,0,0.7)', 'transparent']}
            style={styles.topGradient}
          >
            <View style={styles.topRow}>
              <View style={{ flex: 1 }}>
                {title && (
                  <Text style={styles.title} numberOfLines={1}>
                    {title}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={toggleMute}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                {isMuted ? (
                  <VolumeX color="#FFF" size={20} />
                ) : (
                  <Volume2 color="#FFF" size={20} />
                )}
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Center Controls */}
          <TouchableWithoutFeedback onPress={toggleControls}>
            <View style={styles.centerControls}>
              {/* Skip Back */}
              <TouchableOpacity
                style={styles.seekBtn}
                onPress={() => seekBy(-SEEK_STEP)}
                activeOpacity={0.7}
              >
                <SkipBack color="#FFF" size={24} fill="#FFF" />
                <Text style={styles.seekLabel}>10</Text>
              </TouchableOpacity>

              {/* Play / Pause */}
              <TouchableOpacity
                style={[styles.playPauseBtn, { backgroundColor: accentColor }]}
                onPress={togglePlayPause}
                activeOpacity={0.8}
              >
                {didFinish && !isLooping ? (
                  <RotateCcw color="#000" size={28} />
                ) : isPlaying ? (
                  <Pause color="#000" size={28} fill="#000" />
                ) : (
                  <Play color="#000" size={28} fill="#000" style={{ marginLeft: 3 }} />
                )}
              </TouchableOpacity>

              {/* Skip Forward */}
              <TouchableOpacity
                style={styles.seekBtn}
                onPress={() => seekBy(SEEK_STEP)}
                activeOpacity={0.7}
              >
                <SkipForward color="#FFF" size={24} fill="#FFF" />
                <Text style={styles.seekLabel}>10</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>

          {/* Bottom Gradient + Slider + Time */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.75)']}
            style={styles.bottomGradient}
          >
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <Text style={styles.timeText}>{formatTime(currentTime)}</Text>

              <View
                style={styles.sliderTrack}
                onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
                {...panResponder.panHandlers}
              >
                {/* Unfilled track background */}
                <View style={styles.sliderBackground} />
                {/* Filled track */}
                <View
                  style={[
                    styles.sliderFilled,
                    {
                      width: `${progress * 100}%`,
                      backgroundColor: accentColor,
                    },
                  ]}
                />
                {/* Thumb */}
                <View
                  style={[
                    styles.sliderThumb,
                    {
                      left: `${progress * 100}%`,
                      backgroundColor: accentColor,
                      transform: [
                        { translateX: -7 },
                        { scale: isSeeking ? 1.4 : 1 },
                      ],
                    },
                  ]}
                />
              </View>

              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>

            {/* Bottom Action Row */}
            <View style={styles.bottomRow}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={replay}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <RotateCcw color="#FFF" size={18} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.iconBtn}
                onPress={toggleFullscreen}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                {fullscreen ? (
                  <Minimize2 color="#FFF" size={20} />
                ) : (
                  <Maximize2 color="#FFF" size={20} />
                )}
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    borderRadius: 20,
    overflow: 'hidden',
    width: '100%',
  },
  fullscreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    backgroundColor: '#000',
  },
  videoLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  video: {
    width: '100%',
    height: '100%',
  },

  // Loading / Buffering
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Center flash (play/pause visual feedback)
  centerFlash: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerFlashCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },

  // Controls overlay
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },

  // Top
  topGradient: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Center
  centerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 36,
  },
  seekBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  seekLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontWeight: 'bold',
    position: 'absolute',
    bottom: 5,
  },
  playPauseBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  // Bottom
  bottomGradient: {
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 40,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  timeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 38,
    textAlign: 'center',
  },
  sliderTrack: {
    flex: 1,
    height: SLIDER_HEIGHT,
    justifyContent: 'center',
  },
  sliderBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: (SLIDER_HEIGHT - 4) / 2,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  sliderFilled: {
    position: 'absolute',
    left: 0,
    top: (SLIDER_HEIGHT - 4) / 2,
    height: 4,
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    top: (SLIDER_HEIGHT - 14) / 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },

  // Shared
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
