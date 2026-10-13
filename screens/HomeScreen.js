import React, { useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  ArrowRight,
  Video,
  Eye,
  Play,
  Code2,
  FolderOpen,
} from 'lucide-react-native';
import { COLORS, RADII, SHADOWS } from '../constants/Theme';

const AnimatedFeatureCard = ({
  title,
  desc,
  badgeType,
  onPress,
  fadeAnim,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
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

  const renderBadge = () => {
    if (badgeType === 'instagram') {
      return (
        <LinearGradient
          colors={['#F58529', '#DD2A7B', '#8134AF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.platformBadge}
        >
          <Video color="#FFF" size={14} />
        </LinearGradient>
      );
    }
    if (badgeType === 'stories') {
      return (
        <View style={[styles.platformBadge, { backgroundColor: '#833AB4' }]}>
          <Eye color="#FFF" size={14} />
        </View>
      );
    }
    // YouTube
    return (
      <View style={[styles.platformBadge, { backgroundColor: '#FF0000' }]}>
        <Play color="#FFF" size={14} fill="#FFF" />
      </View>
    );
  };

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        {
          opacity: fadeAnim,
          transform: [
            { scale },
            {
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        style={styles.card}
      >
        <View style={styles.cardTopRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardDesc}>{desc}</Text>
          </View>
          {renderBadge()}
        </View>

        <View style={styles.cardActionRow}>
          <Text style={styles.actionPrompt}>Open Tool</Text>
          <View style={styles.amberArrowBtn}>
            <ArrowRight color="#000" size={16} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function HomeScreen({ navigation }) {
  const heroAnim = useRef(new Animated.Value(0)).current;
  const card1Anim = useRef(new Animated.Value(0)).current;
  const card2Anim = useRef(new Animated.Value(0)).current;
  const card3Anim = useRef(new Animated.Value(0)).current;
  const footerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(90, [
      Animated.timing(heroAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(card1Anim, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(card2Anim, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(card3Anim, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(footerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [heroAnim, card1Anim, card2Anim, card3Anim, footerAnim]);

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Top Header & Hero */}
        <Animated.View
          style={[
            styles.heroSection,
            {
              opacity: heroAnim,
              transform: [
                {
                  translateY: heroAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [15, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.appName}>SAVEX</Text>
          <Text style={styles.heroTitle}>Download{'\n'}Anything.</Text>
          <Text style={styles.heroSubtitle}>
            Fast, high-fidelity media saver for Instagram and YouTube.
          </Text>

          {/* Stats strip */}
          <View style={styles.statsStrip}>
            <View style={styles.statPill}>
              <Text style={styles.statText}>3 Platforms</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statText}>HD Quality</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statText}>Free</Text>
            </View>
          </View>
        </Animated.View>

        {/* Feature Cards (3 total) */}
        <AnimatedFeatureCard
          title="Instagram Reels"
          desc="Download high-definition reels & videos"
          badgeType="instagram"
          fadeAnim={card1Anim}
          onPress={() => navigation.navigate('Reels')}
        />

        <AnimatedFeatureCard
          title="Instagram Stories"
          desc="Anonymous viewing & saving by username or link"
          badgeType="stories"
          fadeAnim={card2Anim}
          onPress={() => navigation.navigate('Stories')}
        />

        <AnimatedFeatureCard
          title="YouTube Media"
          desc="Extract crystal-clear video (MP4) or audio (MP3)"
          badgeType="youtube"
          fadeAnim={card3Anim}
          onPress={() => navigation.navigate('YouTube')}
        />

        {/* Action Row: Vault History + About */}
        <Animated.View
          style={[
            styles.footerActions,
            {
              opacity: footerAnim,
              transform: [
                {
                  translateY: footerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [15, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.historyBtn}
            onPress={() => navigation.navigate('History')}
            activeOpacity={0.8}
          >
            <FolderOpen color={COLORS.primary} size={16} style={{ marginRight: 8 }} />
            <Text style={styles.historyBtnText}>Downloads Vault</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.aboutBtn}
            onPress={() => navigation.navigate('About')}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Code2 color={COLORS.primary} size={16} style={{ marginRight: 8 }} />
              <Text style={styles.aboutBtnText}>About</Text>
            </View>
            <ArrowRight color={COLORS.textSecondary} size={14} />
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingTop: 55, // Top padding for status bar
    paddingHorizontal: 16,
    paddingBottom: 110, // Content padding to clear floating tab bar
  },
  heroSection: {
    marginBottom: 20,
  },
  appName: {
    fontSize: 13,
    color: COLORS.primary,
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontWeight: '800',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 30, // max 30px compact proportions
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 8,
    lineHeight: 19,
  },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  statPill: {
    backgroundColor: COLORS.amberGlass,
    borderWidth: 1,
    borderColor: COLORS.amberBorder,
    borderRadius: RADII.chip,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  statText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  cardContainer: {
    marginBottom: 12,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 16, // NOT 24
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  cardDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  platformBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  actionPrompt: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  amberArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  historyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  historyBtnText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  aboutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  aboutBtnText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
});
