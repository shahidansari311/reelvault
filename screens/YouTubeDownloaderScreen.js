import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Keyboard,
  Image,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import {
  Link2 as LinkIcon,
  Shield,
  Play,
  ChevronLeft,
} from 'lucide-react-native';
import { COLORS, SPACING, SHADOWS } from '../constants/Theme';
import { CustomInput } from '../components/CustomInput';
import { ProgressBar } from '../components/ProgressBar';
import { downloadFile } from '../utils/download';
import { fetchYouTubeInfo, requestYouTubeDownload } from '../services/api';

export default function YouTubeDownloaderScreen({ navigation }) {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [ytFormat, setYtFormat] = useState('mp4'); // mp4 | mp3
  const [ytQuality, setYtQuality] = useState('720p'); // mp4: 360p|720p|1080p, mp3: 128|192|320
  const [ytLoading, setYtLoading] = useState(false);
  const [ytDownloading, setYtDownloading] = useState(false);
  const [ytDownloadProgress, setYtDownloadProgress] = useState(0);
  const [ytInfo, setYtInfo] = useState(null);
  const [ytError, setYtError] = useState(null);

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

  const handleYtFormatChange = (format) => {
    setYtFormat(format);
    setYtError(null);
    setYtInfo(null);
    setYtQuality(format === 'mp4' ? '720p' : '192');
  };

  const handleFetchYouTubeInfo = async () => {
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

  const handleDownloadYouTube = async () => {
    if (!validateYouTubeUrl(youtubeUrl)) {
      Alert.alert('Invalid link', 'Please paste a valid YouTube link.');
      return;
    }
    if (ytDownloading) return;

    const attempt = async () => {
      const payload = await requestYouTubeDownload({
        url: youtubeUrl.trim(),
        format: ytFormat,
        quality: ytQuality,
      });

      setYtInfo({
        title: payload.title || ytInfo?.title || '',
        thumbnail: payload.thumbnail || ytInfo?.thumbnail || '',
        duration: payload.duration || ytInfo?.duration || '',
      });

      if (!payload.downloadUrl) {
        throw new Error('No downloadUrl returned from server');
      }

      const ext = ytFormat === 'mp3' ? 'mp3' : 'mp4';
      const fileName = `youtube_${Date.now()}.${ext}`;
      const success = await downloadFile(payload.downloadUrl, fileName, (p) => setYtDownloadProgress(p));
      if (success) {
        Alert.alert('Success', `${ytFormat.toUpperCase()} saved to your gallery!`);
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
          <Text style={styles.navTitle}>REELVAULT</Text>
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
            Paste a YouTube link, choose format and quality, then download with smooth progress tracking.
          </Text>
        </View>

        <View style={styles.extractionCard}>
          <CustomInput
            placeholder="Paste YouTube link"
            value={youtubeUrl}
            onChangeText={(text) => {
              setYoutubeUrl(text);
              setYtError(null);
            }}
            onClear={() => setYoutubeUrl('')}
            icon={LinkIcon}
            suffix={() => (
              <TouchableOpacity style={styles.inlinePasteBtn} onPress={handlePaste}>
                <Text style={styles.pasteBubbleText}>Paste</Text>
              </TouchableOpacity>
            )}
          />

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Format</Text>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, ytFormat === 'mp4' && styles.chipActive]}
                onPress={() => handleYtFormatChange('mp4')}
                disabled={ytLoading || ytDownloading}
              >
                <Text style={[styles.chipText, ytFormat === 'mp4' && styles.chipTextActive]}>MP4 (Video)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, ytFormat === 'mp3' && styles.chipActive]}
                onPress={() => handleYtFormatChange('mp3')}
                disabled={ytLoading || ytDownloading}
              >
                <Text style={[styles.chipText, ytFormat === 'mp3' && styles.chipTextActive]}>MP3 (Audio)</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Quality</Text>
            <View style={styles.chipRow}>
              {ytFormat === 'mp4'
                ? ['360p', '720p', '1080p'].map((q) => (
                    <TouchableOpacity
                      key={q}
                      style={[styles.chipSmall, ytQuality === q && styles.chipActive]}
                      onPress={() => setYtQuality(q)}
                      disabled={ytLoading || ytDownloading}
                    >
                      <Text style={[styles.chipText, ytQuality === q && styles.chipTextActive]}>{q}</Text>
                    </TouchableOpacity>
                  ))
                : ['128', '192', '320'].map((q) => (
                    <TouchableOpacity
                      key={q}
                      style={[styles.chipSmall, ytQuality === q && styles.chipActive]}
                      onPress={() => setYtQuality(q)}
                      disabled={ytLoading || ytDownloading}
                    >
                      <Text style={[styles.chipText, ytQuality === q && styles.chipTextActive]}>{q} kbps</Text>
                    </TouchableOpacity>
                  ))}
            </View>
          </View>

          <View style={styles.dualBtnRow}>
            <TouchableOpacity
              style={[styles.secondaryBtn, (ytLoading || ytDownloading) && { opacity: 0.7 }]}
              onPress={handleFetchYouTubeInfo}
              disabled={ytLoading || ytDownloading}
            >
              {ytLoading ? (
                <ActivityIndicator color={COLORS.text} size="small" />
              ) : (
                <Text style={styles.secondaryBtnText}>Fetch Info</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, (ytDownloading || ytLoading) && { opacity: 0.7 }]}
              onPress={handleDownloadYouTube}
              disabled={ytDownloading || ytLoading}
            >
              {ytDownloading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Download</Text>
              )}
            </TouchableOpacity>
          </View>

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

        {ytInfo && (
          <View style={styles.previewContainer}>
            <View style={styles.previewFrame}>
              {ytInfo.thumbnail ? (
                <Image source={{ uri: ytInfo.thumbnail }} style={styles.thumbnailImage} />
              ) : (
                <View style={styles.thumbnailPlaceholder}>
                  <Play color={COLORS.text} size={40} />
                </View>
              )}
            </View>

            <View style={styles.metaCard}>
              <Text style={styles.metaTitle}>{ytInfo.title || 'YouTube Video'}</Text>
              {!!ytInfo.duration && <Text style={styles.metaSubtitle}>Duration: {ytInfo.duration}</Text>}
            </View>
          </View>
        )}
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
  optionRow: {
    marginTop: 6,
    marginBottom: 16,
  },
  optionLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
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
  dualBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  secondaryBtn: {
    flex: 1,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.primary,
  },
  primaryBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '900',
  },
  previewContainer: {
    marginTop: 10,
    marginBottom: 40,
  },
  previewFrame: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...SHADOWS.glass,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaCard: {
    backgroundColor: COLORS.surface,
    padding: 24,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    marginBottom: 24,
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

