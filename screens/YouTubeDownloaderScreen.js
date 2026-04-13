import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Keyboard,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { WebView } from 'react-native-webview';
import { useIsFocused } from '@react-navigation/native';
import {
  Link2 as LinkIcon,
  Shield,
  ChevronLeft,
  Download,
} from 'lucide-react-native';
import { COLORS, SPACING, SHADOWS } from '../constants/Theme';
import { CustomInput } from '../components/CustomInput';
import { ProgressBar } from '../components/ProgressBar';
import { downloadFile } from '../utils/download';
import { fetchYouTubeInfo, requestYouTubeDownload } from '../services/api';

export default function YouTubeDownloaderScreen({ navigation }) {
  const isFocused = useIsFocused();
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [ytLoading, setYtLoading] = useState(false);
  const [ytDownloading, setYtDownloading] = useState(false);
  const [ytDownloadProgress, setYtDownloadProgress] = useState(0);
  const [ytInfo, setYtInfo] = useState(null);
  const [ytError, setYtError] = useState(null);
  const [audioBitrate, setAudioBitrate] = useState('192');

  const validateYouTubeUrl = (u) => /(youtube\.com|youtu\.be)\//i.test((u || '').trim());

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (validateYouTubeUrl(text)) {
      setYoutubeUrl(text);
      setYtError(null);
    } else {
      Alert.alert('Clipboard', 'No YouTube link found in clipboard.');
    }
  };

  const handleFetch = async () => {
    if (!validateYouTubeUrl(youtubeUrl)) {
      Alert.alert('Invalid link', 'Please paste a valid YouTube link.');
      return;
    }
    Keyboard.dismiss();
    setYtLoading(true);
    setYtError(null);
    setYtInfo(null);

    try {
      const data = await fetchYouTubeInfo(youtubeUrl.trim());
      setYtInfo(data);
    } catch (err) {
      const title = err.response?.data?.error || 'Network Error';
      const message = err.response?.data?.message || 'Could not fetch video info. Please try again.';
      setYtError({ title, message });
    } finally {
      setYtLoading(false);
    }
  };

  const runDownload = async ({ kind, maxHeight, ext, label }) => {
    if (!validateYouTubeUrl(youtubeUrl) || ytDownloading) return;

    const attempt = async () => {
      const payload = await requestYouTubeDownload({
        url: youtubeUrl.trim(),
        kind,
        maxHeight: kind === 'video' ? maxHeight : undefined,
        audioBitrate: kind === 'audio' ? audioBitrate : undefined,
      });

      if (!payload.downloadUrl) {
        throw new Error('No downloadUrl returned from server');
      }

      const fileName = `youtube_${Date.now()}.${ext}`;
      const success = await downloadFile(payload.downloadUrl, fileName, (p) => setYtDownloadProgress(p));
      if (success) {
        Alert.alert('Success', `${label} saved to your gallery!`);
      }
    };

    setYtDownloading(true);
    setYtDownloadProgress(0);
    setYtError(null);

    try {
      await attempt();
    } catch (err) {
      const title = err.response?.data?.error || 'Download Failed';
      const message = err.response?.data?.message || err.message || 'Could not download. Please try again.';
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Retry',
          onPress: async () => {
            try {
              setYtDownloading(true);
              setYtDownloadProgress(0);
              await attempt();
            } catch (e2) {
              Alert.alert('Download Failed', e2.response?.data?.message || e2.message || 'Retry failed.');
            } finally {
              setYtDownloading(false);
              setYtDownloadProgress(0);
            }
          },
        },
      ]);
    } finally {
      setYtDownloading(false);
      setTimeout(() => setYtDownloadProgress(0), 600);
    }
  };

  const videoOptions = Array.isArray(ytInfo?.videoOptions) ? ytInfo.videoOptions : [];
  const embedUrl = ytInfo?.embedUrl || '';

  return (
    <LinearGradient colors={['#0A0A0B', '#151518', '#050505']} style={styles.container}>
      <LinearGradient
        colors={['rgba(180, 185, 255, 0.03)', 'transparent', 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={[styles.navbar, { justifyContent: 'center' }]}>
        <TouchableOpacity
          style={{ position: 'absolute', left: 0, top: 45, padding: 15 }}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft color={COLORS.text} size={28} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Shield color={COLORS.primary} size={18} style={{ marginRight: 8 }} />
          <Text style={styles.navTitle}>SAVEX</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 150 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>
            YouTube <Text style={{ fontStyle: 'italic', fontWeight: '400', color: COLORS.primary }}>Downloader.</Text>
          </Text>
          <Text style={styles.heroSub}>
            Paste a link and fetch the video first. Preview it here, then pick a format to download.
          </Text>
        </View>

        <View style={styles.extractionCard}>
          <CustomInput
            placeholder="Paste YouTube link"
            value={youtubeUrl}
            onChangeText={(text) => {
              setYoutubeUrl(text);
              setYtError(null);
              setYtInfo(null);
            }}
            onClear={() => {
              setYoutubeUrl('');
              setYtInfo(null);
            }}
            icon={LinkIcon}
            suffix={() => (
              <TouchableOpacity style={styles.inlinePasteBtn} onPress={handlePaste}>
                <Text style={styles.pasteBubbleText}>Paste</Text>
              </TouchableOpacity>
            )}
          />

          <TouchableOpacity
            style={[styles.fetchFullBtn, (ytLoading || ytDownloading) && { opacity: 0.7 }]}
            onPress={handleFetch}
            disabled={ytLoading || ytDownloading}
          >
            {ytLoading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.fetchFullBtnText}>FETCH VIDEO</Text>
            )}
          </TouchableOpacity>

          {ytDownloading && (
            <View style={{ marginTop: 18 }}>
              <ProgressBar progress={ytDownloadProgress} label="Downloading..." />
            </View>
          )}

          {ytError && (
            <View style={styles.errorBubble}>
              <View style={styles.errorIconHeader}>
                <Shield color="#FF6B6B" size={16} />
                <Text style={styles.errorTitle}>{ytError.title}</Text>
              </View>
              <Text style={styles.errorBody}>{ytError.message}</Text>
            </View>
          )}
        </View>

        {ytInfo && embedUrl ? (
          <View style={styles.previewContainer}>
            <View style={styles.webWrap}>
              {isFocused ? (
                <WebView
                  source={{ uri: embedUrl }}
                  style={styles.webView}
                  allowsFullscreenVideo
                  mediaPlaybackRequiresUserAction={false}
                  javaScriptEnabled
                  domStorageEnabled
                />
              ) : (
                <View style={[styles.webView, styles.webPlaceholder]} />
              )}
            </View>

            <View style={styles.metaCard}>
              <Text style={styles.metaTitle}>{ytInfo.title || 'YouTube Video'}</Text>
              {!!ytInfo.duration && <Text style={styles.metaSubtitle}>Duration: {ytInfo.duration}</Text>}
            </View>

            <View style={styles.formatsCard}>
              <Text style={styles.formatsSectionTitle}>Video</Text>
              <Text style={styles.formatsHint}>Tap a quality to download MP4.</Text>
              {videoOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.formatRow, ytDownloading && styles.formatRowDisabled]}
                  onPress={() =>
                    runDownload({
                      kind: 'video',
                      maxHeight: opt.maxHeight,
                      ext: 'mp4',
                      label: opt.label,
                    })
                  }
                  disabled={ytDownloading}
                >
                  <Text style={styles.formatRowText}>{opt.label}</Text>
                  <Download color={COLORS.primary} size={18} />
                </TouchableOpacity>
              ))}

              <Text style={[styles.formatsSectionTitle, { marginTop: 22 }]}>Audio only</Text>
              <Text style={styles.formatsHint}>Choose bitrate, then download MP3.</Text>
              <View style={styles.chipRow}>
                {['128', '192', '320'].map((b) => (
                  <TouchableOpacity
                    key={b}
                    style={[styles.chipSmall, audioBitrate === b && styles.chipActive]}
                    onPress={() => setAudioBitrate(b)}
                    disabled={ytDownloading}
                  >
                    <Text style={[styles.chipText, audioBitrate === b && styles.chipTextActive]}>{b} kbps</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.audioDownloadBtn, ytDownloading && { opacity: 0.6 }]}
                onPress={() =>
                  runDownload({
                    kind: 'audio',
                    maxHeight: undefined,
                    ext: 'mp3',
                    label: `MP3 (${audioBitrate} kbps)`,
                  })
                }
                disabled={ytDownloading}
              >
                <Download color="#000" size={18} style={{ marginRight: 10 }} />
                <Text style={styles.audioDownloadBtnText}>Download MP3</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
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
    marginBottom: 30,
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 40,
    fontWeight: '900',
  },
  heroSub: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 10,
    lineHeight: 22,
    opacity: 0.8,
  },
  extractionCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    marginBottom: 24,
  },
  inlinePasteBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.26)',
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
  fetchFullBtn: {
    backgroundColor: COLORS.primary,
    height: 60,
    borderRadius: 30,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    ...SHADOWS.primary,
  },
  fetchFullBtnText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '900',
  },
  previewContainer: {
    marginTop: 10,
    marginBottom: 40,
  },
  webWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...SHADOWS.glass,
  },
  webView: {
    flex: 1,
    backgroundColor: '#000',
  },
  webPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaCard: {
    backgroundColor: COLORS.surface,
    padding: 24,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    marginBottom: 16,
    alignItems: 'center',
  },
  metaTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 28,
  },
  metaSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 8,
    opacity: 0.9,
    textAlign: 'center',
  },
  formatsCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  formatsSectionTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  formatsHint: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 6,
    marginBottom: 14,
    lineHeight: 18,
  },
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  formatRowDisabled: {
    opacity: 0.5,
  },
  formatRowText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  chipSmall: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  chipActive: {
    backgroundColor: 'rgba(180, 185, 255, 0.18)',
    borderColor: 'rgba(180, 185, 255, 0.35)',
  },
  chipText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextActive: {
    color: COLORS.text,
  },
  audioDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 18,
    ...SHADOWS.primary,
  },
  audioDownloadBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '900',
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
});
