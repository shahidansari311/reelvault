import React, { useRef, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, StatusBar, Image, BackHandler } from 'react-native';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING } from '../constants/Theme';
import VideoPlayer from '../components/VideoPlayer';

export default function InAppPlayerScreen({ navigation, route }) {
  const { filepath, title } = route.params;
  const isFocused = useIsFocused();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Determine media kind: video, audio (mp3/m4a from YouTube), or image.
  // Audio must go through VideoPlayer (expo-video plays audio sources) —
  // previously it fell into the Image branch and silently showed nothing.
  const lowerPath = (filepath || '').toLowerCase();
  const isVideo = filepath && (lowerPath.match(/\.(mp4|mov|m4v|webm|mkv|3gp)$/i) || lowerPath.includes('video'));
  const isAudio = filepath && !!lowerPath.match(/\.(mp3|m4a|wav|aac|opus|ogg|flac|wma)$/i);
  const isPlayable = isVideo || isAudio;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  // Player is only ever opened from History (downloads) — going back
  // (UI button or Android hardware key) must return there, never Home.
  const goBackToHistory = useCallback(() => {
    navigation.navigate('History');
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        goBackToHistory();
        return true;
      });
      return () => sub.remove();
    }, [goBackToHistory])
  );

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <LinearGradient 
        colors={['#050505', '#0A0A0B', '#000000']} 
        style={StyleSheet.absoluteFill}
      />
      
      <Animated.View style={[styles.navbar, { opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
        <LinearGradient
          colors={['rgba(0,0,0,0.8)', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
        <TouchableOpacity style={styles.backBtn} onPress={goBackToHistory}>
          <ChevronLeft color={COLORS.text} size={28} />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.navTitle} numberOfLines={1}>{title || 'Media Vault'}</Text>
          <Text style={styles.navSubtitle}>High Fidelity Playback</Text>
        </View>
      </Animated.View>
      
      <Animated.View style={[styles.playerContainer, { opacity: fadeAnim }]}>
        {isPlayable ? (
          /* Same 9:16 presentation as the Reels tab preview — a bounded box
             the expo-video surface can lay out inside reliably. */
          <View style={styles.videoWrapper}>
            <VideoPlayer
              uri={filepath}
              title={title || 'Media Vault'}
              shouldPlay={isFocused}
              isLooping={false}
              aspectRatio={9 / 16}
              accentColor='#FFC107'
              style={styles.playerBox}
            />
          </View>
        ) : (
          <Image
            source={{ uri: filepath }}
            style={styles.fullPlayer}
            resizeMode="contain"
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 45,
    paddingBottom: 25,
    paddingHorizontal: SPACING.lg,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  titleContainer: {
    flex: 1,
  },
  navTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  navSubtitle: {
    color: '#FFC107',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginTop: 2,
  },
  playerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  videoWrapper: {
    width: '100%',
    aspectRatio: 9 / 16, // bounded box — same approach as Reels preview
    maxWidth: 500,
    backgroundColor: '#000',
    borderRadius: 20,
    overflow: 'hidden',
  },
  playerBox: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
  fullPlayer: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
});
