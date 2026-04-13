import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { 
  ArrowRight,
  EyeOff,
  Globe,
  Shield
} from 'lucide-react-native';
import { COLORS, SPACING, SHADOWS } from '../constants/Theme';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const [clipboardUrl, setClipboardUrl] = React.useState('');

  useFocusEffect(
    React.useCallback(() => {
      checkClipboard();
    }, [])
  );

  const checkClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    if (text.includes('instagram.com/')) {
      setClipboardUrl(text);
    } else {
      setClipboardUrl('');
    }
  };

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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>
            Download your {'\n'}
            <Text style={{ color: COLORS.primary }}>all videos using link.</Text>
          </Text>
          <Text style={styles.heroSub}>
            Save videos quickly by pasting a link. Built with &heart; by Shahid Ansari.
          </Text>
        </View>

        {/* Action 01: Instagram */}
        <TouchableOpacity 
          style={styles.mainActionBox}
          onPress={() => navigation.navigate('Reels')}
        >
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Instagram Videos</Text>
            <ArrowRight color={COLORS.text} size={24} />
          </View>
          <View style={styles.actionPreview}>
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']}
              style={styles.previewOverlay}
            />
            <View style={styles.previewContent}>
              <View style={styles.previewBtn}>
                <Globe color={COLORS.text} size={14} />
                <Text style={styles.previewBtnText}>Paste URL to proceed</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Action 02: Stories */}
        <TouchableOpacity 
          style={styles.mainActionBox}
          onPress={() => navigation.navigate('Stories')}
        >
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Instagram Stories</Text>
            <ArrowRight color={COLORS.text} size={24} />
          </View>
          <View style={styles.actionRow}>
            <View style={styles.quoteBox}>
              <View style={styles.stealthIndicator}>
                <EyeOff color={COLORS.textSecondary} size={14} />
                <Text style={styles.stealthText}>STORY DOWNLOAD</Text>
              </View>
              <View style={styles.openBrowserBtn}>
                <Text style={styles.openBrowserText}>Paste link or by User Name</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
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
    marginTop: 40,
    marginBottom: 40,
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 48,
  },
  heroSub: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 12,
    lineHeight: 22,
    opacity: 0.8,
  },
  actionHeader: {
    marginBottom: 12,
    paddingLeft: 4,
  },
  actionLabel: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  mainActionBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 32,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    overflow: 'hidden',
    ...SHADOWS.glass,
  },
  actionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  actionTitle: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  actionPreview: {
    height: 180,
    borderRadius: 22,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  previewContent: {
    alignItems: 'center',
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  previewBtnText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 10,
    letterSpacing: 0.5,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quoteBox: {
    flex: 1,
  },
  quoteText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
    textAlign: 'center',
  },
  stealthIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  stealthText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 6,
    letterSpacing: 1,
  },
  openBrowserBtn: {
    backgroundColor: COLORS.primary,
    height: 58,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    width: '100%',
    ...SHADOWS.primary,
  },
  openBrowserText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  footerText: {
    color: 'rgba(255,255,255,0.15)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 40,
    letterSpacing: 6,
    fontWeight: '600',
  },
});
