import React, { useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { 
  ArrowRight,
  EyeOff,
  Globe,
  Shield,
  LayoutGrid,
  Play,
  Code2,
  Heart,
} from 'lucide-react-native';
import { COLORS, SPACING, SHADOWS } from '../constants/Theme';

const { width } = Dimensions.get('window');

const AnimatedCard = React.memo(({ children, onPress, fadeAnim }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 50,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View 
      style={[
        styles.cardContainer, 
        { 
          opacity: fadeAnim, 
          transform: [
            { scale }, 
            { translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }
          ] 
        }
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        style={styles.mainActionBox}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
});

export default function HomeScreen({ navigation }) {
  const fadeAnims = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current, // for hero section
  ];

  useEffect(() => {
    Animated.stagger(100, [
      Animated.timing(fadeAnims[4], { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(fadeAnims[0], { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(fadeAnims[1], { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(fadeAnims[2], { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(fadeAnims[3], { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const navigateTo = React.useCallback((screen) => {
    navigation.navigate(screen);
  }, [navigation]);

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
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Shield color={COLORS.primary} size={18} style={{ marginRight: 8 }} />
          <Text style={styles.navTitle}>SAVEX</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 200 }}>
        {/* Hero Section */}
        <Animated.View style={[styles.heroSection, { opacity: fadeAnims[4], transform: [{ translateY: fadeAnims[4].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
          <Text style={styles.heroTitle}>
            Extract your {'\n'}
            <Text style={{ color: COLORS.primary }}>media assets.</Text>
          </Text>
          <Text style={styles.heroSub}>
            High-fidelity extraction for videos, images, and stories. Choose your target below.
          </Text>
        </Animated.View>

        {/* Action 01: Instagram Reels */}
        <AnimatedCard fadeAnim={fadeAnims[0]} onPress={() => navigateTo('Reels')}>
          <View style={styles.actionInfo}>
            <View>
              <Text style={styles.actionTitle}>IG Reels</Text>
              <Text style={styles.actionDesc}>Download high-def videos</Text>
            </View>
            <View style={styles.iconCircle}>
              <Play color="#000" size={20} />
            </View>
          </View>
          <View style={styles.previewBtn}>
            <Text style={styles.previewBtnText}>Proceed to Extraction</Text>
            <ArrowRight color={COLORS.text} size={16} />
          </View>
        </AnimatedCard>

        {/* Action 02: Instagram Stories */}
        <AnimatedCard fadeAnim={fadeAnims[2]} onPress={() => navigateTo('Stories')}>
          <View style={styles.actionInfo}>
            <View>
              <Text style={styles.actionTitle}>IG Stories</Text>
              <Text style={styles.actionDesc}>Anonymous viewing & saving</Text>
            </View>
            <View style={styles.iconCircle}>
              <EyeOff color="#000" size={20} />
            </View>
          </View>
          <View style={styles.previewBtn}>
            <Text style={styles.previewBtnText}>Proceed to Extraction</Text>
            <ArrowRight color={COLORS.text} size={16} />
          </View>
        </AnimatedCard>

        {/* Action 04: YouTube */}
        <AnimatedCard fadeAnim={fadeAnims[3]} onPress={() => navigateTo('YouTube')}>
          <View style={styles.actionInfo}>
            <View>
              <Text style={styles.actionTitle}>YouTube Media</Text>
              <Text style={styles.actionDesc}>Video or Audio (MP3) extraction</Text>
            </View>
            <View style={styles.iconCircle}>
              <Play color="#000" size={20} />
            </View>
          </View>
          <View style={styles.previewBtn}>
            <Text style={styles.previewBtnText}>Proceed to Extraction</Text>
            <ArrowRight color={COLORS.text} size={16} />
          </View>
        </AnimatedCard>

        {/* About the Developer */}
        <Animated.View style={{ opacity: fadeAnims[4], transform: [{ translateY: fadeAnims[4].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
          <TouchableOpacity
            style={styles.aboutBtn}
            onPress={() => navigateTo('About')}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Code2 color={COLORS.primary} size={18} style={{ marginRight: 10 }} />
              <Text style={styles.aboutBtnText}>About the Developer</Text>
            </View>
            <ArrowRight color="rgba(255,255,255,0.3)" size={16} />
          </TouchableOpacity>
        </Animated.View>
        
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
    marginBottom: 35,
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 44,
    fontWeight: '900',
    lineHeight: 52,
  },
  heroSub: {
    color: COLORS.textSecondary,
    fontSize: 15,
    marginTop: 12,
    lineHeight: 24,
    opacity: 0.8,
  },
  cardContainer: {
    marginBottom: 20,
  },
  mainActionBox: {
    backgroundColor: 'rgba(20, 20, 25, 0.7)',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    ...SHADOWS.glass,
  },
  actionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  actionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  actionDesc: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.primary,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  previewBtnText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  aboutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 22,
    marginTop: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  aboutBtnText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
