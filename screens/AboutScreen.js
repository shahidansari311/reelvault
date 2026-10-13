import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Linking,
  Animated,
  Keyboard,
  ActivityIndicator,
  Dimensions,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Shield,
  Link,
  Code,
  Globe,
  AtSign,
  Send,
  Heart,
  Star,
  MessageSquare,
  ExternalLink,
  User,
  Code2,
  ChevronRight,
} from 'lucide-react-native';
import { COLORS, SPACING, SHADOWS } from '../constants/Theme';
import { showAlert } from '../utils/alert';
import { submitFeedback } from '../services/api';

const { width } = Dimensions.get('window');

// ─── Animated Social Link Card ───
const SocialCard = ({ icon: Icon, label, sublabel, url, color, index }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, delay: index * 80, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay: index * 80, friction: 7, useNativeDriver: true }),
    ]).start();
  }, []);

  const handlePressIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ opacity, transform: [{ scale }, { translateY }] }}>
      <TouchableOpacity
        style={styles.socialCard}
        onPress={() => Linking.openURL(url)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <View style={[styles.socialIconCircle, { backgroundColor: `${color}15` }]}>
          <Icon color={color} size={20} />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.socialLabel}>{label}</Text>
          <Text style={styles.socialSublabel} numberOfLines={1}>{sublabel}</Text>
        </View>
        <ExternalLink color="rgba(255,255,255,0.2)" size={16} />
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function AboutScreen({ navigation }) {
  const [feedbackName, setFeedbackName] = useState('');
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(0.9)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(heroOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(heroScale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  const socialLinks = [
    { icon: Code, label: 'GitHub', sublabel: 'shahidansari111', url: 'https://github.com/shahidansari111', color: '#E6EDF3' },
    { icon: Link, label: 'LinkedIn', sublabel: 'Shahid Ansari', url: 'https://www.linkedin.com/in/shahid-ansari-433449327/', color: '#0A66C2' },
    { icon: Code2, label: 'LeetCode', sublabel: 'shahid310 • 1584 rated', url: 'https://leetcode.com/u/shahid310/', color: '#FFA116' },
    { icon: Globe, label: 'Portfolio', sublabel: 'View My Work', url: 'https://shahidansari.vercel.app/', color: '#8B5CF6' },
    { icon: AtSign, label: 'X (Twitter)', sublabel: '@Shahid_310_', url: 'https://x.com/Shahid_310_', color: '#1DA1F2' },
    { icon: Link, label: 'Instagram', sublabel: '@_shahid_129_', url: 'https://instagram.com/_shahid_129_', color: '#E1306C' },
  ];

  const handleSubmitFeedback = async () => {
    if (!feedbackMessage.trim()) {
      showAlert('Missing Feedback', 'Please write your feedback before submitting.');
      return;
    }

    Keyboard.dismiss();
    setSubmitting(true);

    try {
      const result = await submitFeedback({
        name: feedbackName.trim() || 'Anonymous',
        email: feedbackEmail.trim() || '',
        message: feedbackMessage.trim(),
        rating: feedbackRating,
        timestamp: new Date().toISOString(),
      });

      setSubmitted(true);
      setFeedbackName('');
      setFeedbackEmail('');
      setFeedbackMessage('');
      setFeedbackRating(0);

      if (result?.emailSent) {
        showAlert('Thank You! 🎉', 'Your feedback has been submitted and emailed successfully!');
      } else {
        showAlert('Thank You! 🎉', 'Your feedback has been saved. I\'ll see it soon!');
      }
    } catch (err) {
      const serverMsg = err?.response?.data?.error;
      if (err?.response) {
        showAlert('Oops!', serverMsg || 'Could not submit feedback right now. Please try again later.');
      } else {
        showAlert('No Connection', 'Could not reach the server. Please check your internet and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={['#0A0A0B', '#151518', '#050505']} style={styles.container}>
      <LinearGradient
        colors={['rgba(180, 185, 255, 0.03)', 'transparent', 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Navbar */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft color={COLORS.text} size={24} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Shield color={COLORS.primary} size={18} style={{ marginRight: 8 }} />
          <Text style={styles.navTitle}>ABOUT</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 150 }}
      >
        {/* App Hero */}
        <Animated.View style={[styles.appHero, { opacity: heroOpacity, transform: [{ scale: heroScale }] }]}>
          <LinearGradient
            colors={['rgba(255, 193, 7, 0.14)', 'rgba(255, 193, 7, 0.03)', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Image source={require('../assets/logo.png')} style={styles.appLogo} />
          <Text style={styles.appName}>SaveX</Text>
          <Text style={styles.appTagline}>Save Reels, Stories & Videos — beautifully.</Text>
          <View style={styles.versionChip}>
            <Text style={styles.versionChipText}>v1.0.0</Text>
          </View>
          <Text style={styles.appDesc}>
            Your personal vault for Instagram reels, stories and YouTube videos.
            Background downloads, in-app player and full offline history.
          </Text>
        </Animated.View>

        {/* Developer — name only */}
        <Animated.View style={[styles.heroCard, { opacity: heroOpacity }]}>
          <View style={styles.sectionHeader}>
            <User color={COLORS.primary} size={20} />
            <Text style={styles.sectionTitle}>Developer</Text>
          </View>

          {/* Avatar Circle */}
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={[COLORS.primary, '#8B5CF6', '#6366F1']}
              style={styles.avatarGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.avatarText}>SA</Text>
            </LinearGradient>
            <View style={styles.onlineDot} />
          </View>

          <Text style={styles.heroName}>Shahid Ansari</Text>
        </Animated.View>

        {/* Social Links */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Globe color={COLORS.primary} size={20} />
            <Text style={styles.sectionTitle}>Connect With Me</Text>
          </View>
          {socialLinks.map((link, index) => (
            <SocialCard key={link.label} {...link} index={index} />
          ))}
        </View>

        {/* Feedback Form */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MessageSquare color={COLORS.primary} size={20} />
            <Text style={styles.sectionTitle}>Send Feedback</Text>
          </View>
          <Text style={styles.feedbackHint}>
            Got suggestions, bug reports, or just want to say hi? Drop your feedback below!
          </Text>

          {/* Star Rating */}
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingLabel}>Rate the App</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setFeedbackRating(star)} style={styles.starBtn}>
                  <Star
                    size={28}
                    color={star <= feedbackRating ? '#FFD700' : 'rgba(255,255,255,0.15)'}
                    fill={star <= feedbackRating ? '#FFD700' : 'transparent'}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Name Input */}
          <View style={styles.feedbackInputWrap}>
            <User color="rgba(255,255,255,0.3)" size={16} style={{ marginRight: 10 }} />
            <TextInput
              style={styles.feedbackInput}
              placeholder="Your Name (optional)"
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={feedbackName}
              onChangeText={setFeedbackName}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          {/* Email Input */}
          <View style={styles.feedbackInputWrap}>
            <Mail color="rgba(255,255,255,0.3)" size={16} style={{ marginRight: 10 }} />
            <TextInput
              style={styles.feedbackInput}
              placeholder="Your Email (optional)"
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={feedbackEmail}
              onChangeText={setFeedbackEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Message Input */}
          <View style={[styles.feedbackInputWrap, { height: 120, alignItems: 'flex-start', paddingTop: 14 }]}>
            <MessageSquare color="rgba(255,255,255,0.3)" size={16} style={{ marginRight: 10, marginTop: 2 }} />
            <TextInput
              style={[styles.feedbackInput, { height: '100%', textAlignVertical: 'top' }]}
              placeholder="Write your feedback here..."
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={feedbackMessage}
              onChangeText={setFeedbackMessage}
              multiline
              autoCorrect={false}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmitFeedback}
            disabled={submitting}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[COLORS.primary, '#8B5CF6']}
              style={styles.submitBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {submitting ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <>
                  <Send color="#000" size={18} style={{ marginRight: 10 }} />
                  <Text style={styles.submitBtnText}>SUBMIT FEEDBACK</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {submitted && (
            <View style={styles.thanksRow}>
              <Heart color="#FF6B6B" size={14} fill="#FF6B6B" />
              <Text style={styles.thanksText}>Thanks for your feedback!</Text>
            </View>
          )}
        </View>

        {/* How to reach About */}
        <TouchableOpacity
          style={styles.homeHint}
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.8}
        >
          <Text style={styles.homeHintText}>Back to Home</Text>
          <ChevronRight color={COLORS.primary} size={16} />
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Built with <Text style={{ color: '#FF6B6B' }}>❤️</Text> by Shahid Ansari</Text>
          <Text style={styles.footerSub}>SaveX v1.0.0</Text>
        </View>
      </ScrollView>
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
    paddingTop: 55,
    paddingBottom: 15,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  navTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },

  // App Hero
  appHero: {
    backgroundColor: COLORS.surface,
    borderRadius: 32,
    padding: 30,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.amberBorder,
    alignItems: 'center',
    overflow: 'hidden',
    ...SHADOWS.primary,
  },
  appLogo: {
    width: 84,
    height: 84,
    borderRadius: 24,
    marginBottom: 14,
  },
  appName: {
    color: COLORS.text,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  appTagline: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
  versionChip: {
    backgroundColor: COLORS.amberGlass,
    borderWidth: 1,
    borderColor: COLORS.amberBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginTop: 12,
  },
  versionChipText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  appDesc: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 14,
  },

  // Hero Card
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 32,
    padding: 28,
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    alignItems: 'center',
    overflow: 'hidden',
    ...SHADOWS.glass,
  },
  avatarContainer: {
    marginBottom: 16,
    marginTop: 14,
    position: 'relative',
  },
  avatarGradient: {
    width: 92,
    height: 92,
    borderRadius: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 34,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 2,
  },
  onlineDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#22C55E',
    position: 'absolute',
    bottom: 2,
    right: 2,
    borderWidth: 3,
    borderColor: COLORS.surface,
  },
  heroName: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // Section Card
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 28,
    padding: 26,
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    ...SHADOWS.glass,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: '800',
    marginLeft: 10,
    letterSpacing: 0.3,
  },
  // Social Cards
  socialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  socialIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialLabel: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  socialSublabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },

  // Feedback
  feedbackHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },
  ratingContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  ratingLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  starBtn: {
    padding: 4,
  },
  feedbackInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  feedbackInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    height: '100%',
  },
  submitBtn: {
    marginTop: 8,
    borderRadius: 18,
    overflow: 'hidden',
  },
  submitBtnGradient: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
  },
  submitBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  thanksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    gap: 6,
  },
  thanksText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
  },

  // Home hint
  homeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    gap: 4,
  },
  homeHintText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 20,
  },
  footerText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 14,
    fontWeight: '600',
  },
  footerSub: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
