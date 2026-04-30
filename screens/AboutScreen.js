import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
  Animated,
  Keyboard,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Shield,
  Link,
  Code,
  Globe,
  AtSign,
  Mail,
  Phone,
  MapPin,
  Send,
  Heart,
  Code2,
  Star,
  MessageSquare,
  ChevronRight,
  ExternalLink,
  User,
  Sparkles,
} from 'lucide-react-native';
import { COLORS, SPACING, SHADOWS } from '../constants/Theme';
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

// ─── Contact Info Pill ───
const ContactPill = ({ icon: Icon, text, onPress }) => (
  <TouchableOpacity style={styles.contactPill} onPress={onPress} activeOpacity={0.7}>
    <Icon color={COLORS.primary} size={14} />
    <Text style={styles.contactPillText} numberOfLines={1}>{text}</Text>
  </TouchableOpacity>
);

// ─── Stat Card ───
const StatCard = ({ label, value, icon: Icon }) => (
  <View style={styles.statCard}>
    <Icon color={COLORS.primary} size={18} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

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
    { icon: Link, label: 'LinkedIn', sublabel: 'Shahid Ansari', url: 'https://www.linkedin.com/in/shahid-ansari-433449327/', color: '#0A66C2' },
    { icon: Code, label: 'GitHub', sublabel: 'shahidansari311', url: 'https://github.com/shahidansari311', color: '#E6EDF3' },
    { icon: Globe, label: 'Portfolio', sublabel: 'View My Work', url: 'https://shahidansari.vercel.app/', color: '#8B5CF6' },
    { icon: AtSign, label: 'X (Twitter)', sublabel: '@Shahid_310_', url: 'https://x.com/Shahid_310_', color: '#1DA1F2' },
  ];

  const handleSubmitFeedback = async () => {
    if (!feedbackMessage.trim()) {
      Alert.alert('Missing Feedback', 'Please write your feedback before submitting.');
      return;
    }

    Keyboard.dismiss();
    setSubmitting(true);

    try {
      await submitFeedback({
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
      Alert.alert('Thank You! 🎉', 'Your feedback has been submitted successfully. I really appreciate it!');
    } catch (err) {
      Alert.alert('Oops!', 'Could not submit feedback right now. Please try again later.');
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
        {/* Developer Hero Card */}
        <Animated.View style={[styles.heroCard, { opacity: heroOpacity, transform: [{ scale: heroScale }] }]}>
          <LinearGradient
            colors={['rgba(139, 92, 246, 0.12)', 'rgba(139, 92, 246, 0.03)', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />

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
          <Text style={styles.heroRole}>Full-Stack Developer</Text>

          {/* Contact Pills */}
          <View style={styles.contactRow}>
            <ContactPill icon={MapPin} text="Ghaziabad, India" onPress={() => {}} />
            <ContactPill icon={Phone} text="+91-8858369783" onPress={() => Linking.openURL('tel:+918858369783')} />
          </View>
          <View style={styles.contactRow}>
            <ContactPill icon={Mail} text="shahidansari945256@gmail.com" onPress={() => Linking.openURL('mailto:shahidansari945256@gmail.com')} />
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <StatCard label="Stack" value="MERN" icon={Code2} />
            <StatCard label="Projects" value="4+" icon={Star} />
            <StatCard label="Focus" value="Web App" icon={Sparkles} />
          </View>
        </Animated.View>

        {/* About Me Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <User color={COLORS.primary} size={18} />
            <Text style={styles.sectionTitle}>About Me</Text>
          </View>
          <Text style={styles.bioText}>
            Full-Stack Developer and Computer Science student with experience building MERN and PERN stack applications. 
            Skilled in creating scalable web apps, real-time systems, and modern web apps. Passionate about software engineering 
            and problem solving.
          </Text>
          <View style={styles.techChipsRow}>
            {['React JS', 'Node.js', 'MongoDB', 'PostgreSQL', 'Express', 'Next.js'].map((tech) => (
              <View key={tech} style={styles.techChip}>
                <Text style={styles.techChipText}>{tech}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Social Links */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Globe color={COLORS.primary} size={18} />
            <Text style={styles.sectionTitle}>Connect With Me</Text>
          </View>
          {socialLinks.map((link, index) => (
            <SocialCard key={link.label} {...link} index={index} />
          ))}
        </View>

        {/* Feedback Form */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MessageSquare color={COLORS.primary} size={18} />
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

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Built with <Text style={{ color: '#FF6B6B' }}>❤️</Text> by Shahid Ansari</Text>
          <Text style={styles.footerSub}>SaveX v1.3.0</Text>
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
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },

  // Hero Card
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 32,
    padding: 28,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    alignItems: 'center',
    overflow: 'hidden',
    ...SHADOWS.glass,
  },
  avatarContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  avatarGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 2,
  },
  onlineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#22C55E',
    position: 'absolute',
    bottom: 2,
    right: 2,
    borderWidth: 3,
    borderColor: COLORS.surface,
  },
  heroName: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroRole: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 4,
  },

  // Contact Pills
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  contactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  contactPillText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginLeft: 6,
    fontWeight: '600',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 6,
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },

  // Section Card
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 28,
    padding: 24,
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
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 10,
    letterSpacing: 0.3,
  },
  bioText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    lineHeight: 22,
  },
  techChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    gap: 8,
  },
  techChip: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
  },
  techChipText: {
    color: '#A78BFA',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
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
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  socialSublabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },

  // Feedback
  feedbackHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    lineHeight: 20,
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
    height: 50,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  feedbackInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
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
    fontSize: 14,
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
    fontSize: 12,
    fontWeight: '600',
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  footerText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    fontWeight: '600',
  },
  footerSub: {
    color: 'rgba(255,255,255,0.15)',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
