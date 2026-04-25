import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, StatusBar, Image } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { ChevronLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, SHADOWS } from '../constants/Theme';

export default function InAppPlayerScreen({ navigation, route }) {
  const { filepath, title } = route.params;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Determine if the media is a video based on common video extensions or 'video' in the path
  const isVideo = filepath && (filepath.toLowerCase().match(/\.(mp4|mov|m4v|webm)$/i) || filepath.toLowerCase().includes('video'));

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

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
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft color={COLORS.text} size={28} />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.navTitle} numberOfLines={1}>{title || 'Media Vault'}</Text>
          <Text style={styles.navSubtitle}>High Fidelity Playback</Text>
        </View>
      </Animated.View>
      
      <Animated.View style={[styles.playerContainer, { opacity: fadeAnim, transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] }]}>
        <View style={styles.videoWrapper}>
          {isVideo ? (
            <Video
              source={{ uri: filepath }}
              style={styles.video}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
            />
          ) : (
            <Image
              source={{ uri: filepath }}
              style={styles.video}
              resizeMode="contain"
            />
          )}
        </View>
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
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginTop: 2,
  },
  playerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoWrapper: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
});
