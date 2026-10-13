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
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
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
import { COLORS } from '../constants/Theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SEEK_STEP = 10; // seconds
const CONTROLS_TIMEOUT = 4000; // auto-hide after 4s
const SLIDER_HEIGHT = 36;

/**
 * Premium dark video player with sunflower amber custom controls.
 * Uses expo-video (SDK 57) under the hood.
 */
export default function VideoPlayer({
  uri,
  title,
  shouldPlay = true,
  isLooping = true,
  aspectRatio = 16 / 9,
  onFullscreenChange,
  style,
  accentColor = COLORS.primary, // Default sunflower amber #FFC107
}) {
  const controlsTimeout = useRef(null);

  const [showControls, setShowControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);
  const [sliderWidth, setSliderWidth] = useState(SCREEN_WIDTH - 120);
  const [didFinish, setDidFinish] = useState(false);

  // Animations
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const centerIconScale = useRef(new Animated.Value(0)).current;
  const centerIconOpacity = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0.4)).current;

  // expo-video player. Re-created when uri changes.
  const player = useVideoPlayer(uri ? { uri } : null, (p) => {
    p.loop = isLooping;
    p.timeUpdateEventInterval = 0.5;
    if (shouldPlay && uri) {
      p.play();
    }
  });

  // Keep loop flag in sync
  useEffect(() => {
    if (player) player.loop = isLooping;
  }, [player, isLooping]);

  // React to shouldPlay changes
  useEffect(() => {
    if (!player) return;
    try {
      if (shouldPlay) {
        if (didFinish && !isLooping) {
          player.replay();
        } else if (!player.playing) {
          player.play();
        }
      } else if (player.playing) {
        player.pause();
      }
    } catch (e) {
      console.warn('VideoPlayer play/pause error:', e);
    }
  }, [shouldPlay, player, didFinish, isLooping]);

  // React to URI changes (useVideoPlayer does not auto-swap the source)
  const lastUri = useRef(uri);
  useEffect(() => {
    if (player && uri && lastUri.current !== uri) {
      lastUri.current = uri;
      try {
        player.replace({ uri });
        if (shouldPlay) player.play();
      } catch (e) {
        console.warn('VideoPlayer source replace error:', e);
      }
    }
  }, [uri, player, shouldPlay]);

  // Live player state via events
  const playingChange = useEvent(player, 'playingChange', {
    isPlaying: player?.playing ?? false,
  });
  const statusChange = useEvent(player, 'statusChange', {
    status: player?.status ?? 'loading',
  });
  const timeUpdate = useEvent(player, 'timeUpdate', {
    currentTime: 0,
    bufferedPosition: 0,
  });
  const mutedChange = useEvent(player, 'mutedChange', {
    muted: player?.muted ?? false,
  });

  // playToEnd clears when looping, otherwise marks finished
  useEvent(player, 'playToEnd', () => {
    if (!player?.loop) setDidFinish(true);
  });

  // Reset finished flag when playback resumes
  useEffect(() => {
    if (playingChange?.isPlaying) setDidFinish(false);
  }, [playingChange?.isPlaying]);

  // Derived state (same names as before so the UI below is untouched)
  const isPlaying = playingChange?.isPlaying ?? false;
  const status = statusChange?.status ?? 'loading';
  const isLoaded = status === 'readyToPlay';
  const isBuffering = status === 'loading';
  const isMuted = mutedChange?.muted ?? false;
  const duration = player?.duration ?? 0;
  const livePosition = timeUpdate?.currentTime ?? player?.currentTime ?? 0;
  const currentTime = isSeeking ? seekPosition : livePosition;
  const progress = duration > 0 ? currentTime / duration : 0;

  // Shimmer pulse animation for loading state
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 0.85, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [shimmerAnim]);

  // ─── Controls Visibility ───────────────────────────────────────
  const hideControls = useCallback(() => {
    Animated.timing(controlsOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setShowControls(false));
  }, [controlsOpacity]);

  const resetControlsTimer = useCallback(() => {
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    if (isPlaying && !isSeeking) {
      controlsTimeout.current = setTimeout(() => {
        hideControls();
      }, CONTROLS_TIMEOUT);
    }
  }, [isPlaying, isSeeking, hideControls]);

  const showControlsAnimated = useCallback(() => {
    setShowControls(true);
    Animated.timing(controlsOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
    resetControlsTimer();
  }, [resetControlsTimer, controlsOpacity]);

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
        duration: 500,
        delay: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const togglePlayPause = () => {
    if (!player || !isLoaded) return;
    try {
      if (didFinish && !isLooping) {
        player.replay();
      } else if (isPlaying) {
        player.pause();
      } else {
        player.play();
      }
    } catch (e) {
      console.warn('togglePlayPause error:', e);
    }
    flashCenterIcon();
    resetControlsTimer();
  };

  const seekBy = (seconds) => {
    if (!player || !isLoaded) return;
    try {
      player.seekBy(seconds);
    } catch (e) {
      console.warn('seekBy error:', e);
    }
    showControlsAnimated();
  };

  const seekTo = (seconds) => {
    if (!player || !isLoaded) return;
    setIsSeeking(false);
    try {
      player.currentTime = Math.max(0, Math.min(duration, seconds));
    } catch (e) {
      console.warn('seekTo error:', e);
    }
    resetControlsTimer();
  };

  const toggleMute = () => {
    if (!player || !isLoaded) return;
    try {
      player.muted = !isMuted;
    } catch (e) {
      console.warn('toggleMute error:', e);
    }
  };

  const replay = () => {
    if (!player || !isLoaded) return;
    try {
      player.replay();
    } catch (e) {
      console.warn('replay error:', e);
    }
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
          <VideoView
            player={player}
            style={styles.video}
            contentFit={fullscreen ? 'contain' : 'cover'}
            nativeControls={false}
            allowsFullscreen={false}
          />
        </View>
      </TouchableWithoutFeedback>

      {/* Buffering: semi-transparent overlay with small amber ActivityIndicator (not blocking) */}
      {isBuffering && isLoaded && (
        <View style={styles.bufferingOverlay} pointerEvents="none">
          <View style={styles.bufferingBubble}>
            <ActivityIndicator size="small" color={accentColor} />
          </View>
        </View>
      )}

      {/* Initial Loading: animated skeleton shimmer with pulsing gradient + amber spinner */}
      {!isLoaded && (
        <Animated.View style={[styles.loadingOverlay, { opacity: shimmerAnim }]} pointerEvents="none">
          <LinearGradient
            colors={['#161618', '#222226', '#161618']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <ActivityIndicator size="large" color={accentColor} />
          <Text style={styles.loadingText}>Loading video...</Text>
        </Animated.View>
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
        <View style={[styles.centerFlashCircle, { backgroundColor: 'rgba(255, 193, 7, 0.2)' }]}>
          {isPlaying ? (
            <Pause color="#FFF" size={28} fill="#FFF" />
          ) : (
            <Play color="#FFF" size={28} fill="#FFF" />
          )}
        </View>
      </Animated.View>

      {/* Controls Overlay */}
      {showControls && (
        <Animated.View style={[styles.controlsOverlay, { opacity: controlsOpacity }]}>
          {/* Top Gradient + Title (13px) */}
          <LinearGradient
            colors={['rgba(0,0,0,0.75)', 'transparent']}
            style={styles.topGradient}
          >
            <View style={styles.topRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
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
                  <VolumeX color="#FFF" size={18} />
                ) : (
                  <Volume2 color="#FFF" size={18} />
                )}
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Center Controls */}
          <TouchableWithoutFeedback onPress={toggleControls}>
            <View style={styles.centerControls}>
              {/* Skip Back: 44px circle */}
              <TouchableOpacity
                style={styles.seekBtn}
                onPress={() => seekBy(-SEEK_STEP)}
                activeOpacity={0.7}
              >
                <SkipBack color="#FFF" size={20} fill="#FFF" />
                <Text style={styles.seekLabel}>10</Text>
              </TouchableOpacity>

              {/* Play / Pause: 60px amber background */}
              <TouchableOpacity
                style={[styles.playPauseBtn, { backgroundColor: accentColor }]}
                onPress={togglePlayPause}
                activeOpacity={0.8}
              >
                {didFinish && !isLooping ? (
                  <RotateCcw color="#000" size={24} />
                ) : isPlaying ? (
                  <Pause color="#000" size={24} fill="#000" />
                ) : (
                  <Play color="#000" size={24} fill="#000" style={{ marginLeft: 2 }} />
                )}
              </TouchableOpacity>

              {/* Skip Forward: 44px circle */}
              <TouchableOpacity
                style={styles.seekBtn}
                onPress={() => seekBy(SEEK_STEP)}
                activeOpacity={0.7}
              >
                <SkipForward color="#FFF" size={20} fill="#FFF" />
                <Text style={styles.seekLabel}>10</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>

          {/* Bottom Gradient + Slider + Time */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.bottomGradient}
          >
            {/* Progress Bar (6px tall track, 18px thumb) */}
            <View style={styles.progressContainer}>
              <Text style={styles.timeText}>{formatTime(currentTime)}</Text>

              <View
                style={styles.sliderTrack}
                onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
                {...panResponder.panHandlers}
              >
                {/* 6px tall track background */}
                <View style={styles.sliderBackground} />
                {/* 6px tall filled track */}
                <View
                  style={[
                    styles.sliderFilled,
                    {
                      width: `${progress * 100}%`,
                      backgroundColor: accentColor,
                    },
                  ]}
                />
                {/* 18px diameter thumb */}
                <View
                  style={[
                    styles.sliderThumb,
                    {
                      left: `${progress * 100}%`,
                      backgroundColor: accentColor,
                      transform: [
                        { translateX: -9 },
                        { scale: isSeeking ? 1.3 : 1 },
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
                <RotateCcw color="#FFF" size={16} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.iconBtn}
                onPress={toggleFullscreen}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                {fullscreen ? (
                  <Minimize2 color="#FFF" size={18} />
                ) : (
                  <Maximize2 color="#FFF" size={18} />
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
    backgroundColor: COLORS.surface,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bufferingBubble: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    padding: 10,
    borderRadius: 20,
  },

  // Center flash (play/pause visual feedback)
  centerFlash: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerFlashCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 193, 7, 0.4)',
  },

  // Controls overlay
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },

  // Top
  topGradient: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 26,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#FFF',
    fontSize: 13, // Title text 13px
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
    gap: 30,
  },
  seekBtn: {
    width: 44, // 44px circle (was 52px)
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  seekLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 8,
    fontWeight: 'bold',
    position: 'absolute',
    bottom: 4,
  },
  playPauseBtn: {
    width: 60, // 60px (was 68px), amber background
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },

  // Bottom
  bottomGradient: {
    paddingBottom: 12,
    paddingHorizontal: 14,
    paddingTop: 36,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  timeText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 36,
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
    top: (SLIDER_HEIGHT - 6) / 2,
    height: 6, // 6px tall track (was 4px)
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  sliderFilled: {
    position: 'absolute',
    left: 0,
    top: (SLIDER_HEIGHT - 6) / 2,
    height: 6, // 6px tall track
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    top: (SLIDER_HEIGHT - 18) / 2,
    width: 18, // 18px diameter thumb (was 14px)
    height: 18,
    borderRadius: 9,
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
    paddingHorizontal: 2,
  },

  // Shared
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
