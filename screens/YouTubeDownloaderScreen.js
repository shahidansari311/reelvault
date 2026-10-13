import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  ScrollView,
  Modal,
  Image,
  Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { showAlert } from '../utils/alert';
import {
  ArrowLeft,
  Link2 as LinkIcon,
  Shield,
  Download,
} from 'lucide-react-native';
import { COLORS, RADII, SHADOWS } from '../constants/Theme';
import { CustomInput } from '../components/CustomInput';
import { DownloadProgressBar } from '../components/DownloadProgressBar';
import { startBackgroundDownload } from '../services/backgroundDownload';
import { fetchYouTubeInfo, requestYouTubeDownload } from '../services/api';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRateLimited = (err) => {
  const status = err?.response?.status;
  return status === 429 || status === 502 || status === 503;
};

// Auto-retries rate-limit / server-busy failures with exponential backoff
// (4s → 8s → 16s). Returns { data } or { error } — never throws.
const withRateLimitRetry = async (fn, { retries = 3, onRetry } = {}) => {
  let lastErr = null;
  for (let i = 0; i <= retries; i++) {
    try {
      return { data: await fn() };
    } catch (err) {
      lastErr = err;
      if (!isRateLimited(err) || i === retries) break;
      const delaySecs = 4 * 2 ** i;
      try {
        onRetry && onRetry(i + 1, retries + 1, delaySecs);
      } catch (e) {}
      await sleep(delaySecs * 1000);
    }
  }
  return { error: lastErr };
};

export default function YouTubeDownloaderScreen({ navigation, route }) {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [ytLoading, setYtLoading] = useState(false);
  const [ytDownloading, setYtDownloading] = useState(false);
  const [ytDownloadProgress, setYtDownloadProgress] = useState(0);
  const [ytInfo, setYtInfo] = useState(null);
  const [ytError, setYtError] = useState(null);
  const [audioBitrate, setAudioBitrate] = useState('192');
  const [showFormatModal, setShowFormatModal] = useState(false);

  // Tracked auto-fetch timer: cleared on unmount and when the user types,
  // so a stale share-link fetch can't leak or overwrite manual input.
  const autoFetchTimeoutRef = React.useRef(null);
  // Client-side 429 cooldown: after YouTube rate-limits us, every retry
  // (auto + manual) just extends the server's IP ban — block refetch until
  // the window passes instead.
  const rateLimitedUntilRef = React.useRef(0);
  const clearPendingAutoFetch = () => {
    if (autoFetchTimeoutRef.current) {
      clearTimeout(autoFetchTimeoutRef.current);
      autoFetchTimeoutRef.current = null;
    }
  };
  React.useEffect(() => () => clearPendingAutoFetch(), []);

  const validateYouTubeUrl = (u) => {
    const url = (u || '').trim();
    return /(youtube\.com|youtu\.be|youtube\.com\/shorts)\//i.test(url);
  };

  React.useEffect(() => {
    if (route?.params?.initialUrl) {
      setYoutubeUrl(route.params.initialUrl);
      const urlToFetch = route.params.initialUrl;
      clearPendingAutoFetch();
      autoFetchTimeoutRef.current = setTimeout(() => {
        autoFetchTimeoutRef.current = null;
        handleFetchUrl(urlToFetch);
      }, 500);
    }
  }, [route?.params?.initialUrl]);

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (validateYouTubeUrl(text)) {
      setYoutubeUrl(text);
      setYtError(null);
    } else {
      showAlert('Nothing to Paste', 'No YouTube link found in your clipboard. Copy a YouTube link first.');
    }
  };

  const handleFetch = async () => {
    handleFetchUrl(youtubeUrl);
  };

  const handleFetchUrl = async (urlToFetch) => {
    if (!validateYouTubeUrl(urlToFetch)) {
      showAlert('Wrong Link', "That doesn't look like a YouTube link. Please paste a link from youtube.com or youtu.be.");
      return;
    }
    // Respect the post-429 cooldown — hammering retries extends the ban.
    const waitMs = rateLimitedUntilRef.current - Date.now();
    if (waitMs > 0) {
      const secs = Math.ceil(waitMs / 1000);
      showAlert('Slow Down', `YouTube limited our server. Please wait ~${secs}s before trying again — retrying early only extends the block.`);
      return;
    }
    Keyboard.dismiss();
    setYtLoading(true);
    setYtError(null);
    setYtInfo(null);

    try {
      const { data, error } = await withRateLimitRetry(
        () => fetchYouTubeInfo(urlToFetch.trim()),
        {
          onRetry: (n, total, secs) =>
            setYtError({
              title: 'YouTube is Busy',
              message: `Rate limited — automatic retry ${n}/${total} in ${secs}s…`,
            }),
        }
      );
      if (error) throw error;
      setYtInfo(data);
    } catch (err) {
      const serverData = err.response?.data;
      const status = err.response?.status;

      let title = serverData?.error || 'Something Went Wrong';
      let message = serverData?.message || err.message || "We couldn't get info about this video. Please try again.";

      if (status === 400) {
        title = serverData?.error || 'Wrong Link';
        message = serverData?.message || "That doesn't look like a YouTube link. Please check and try again.";
      } else if (status === 429) {
        title = serverData?.error || 'YouTube is Busy';
        message = serverData?.message || 'YouTube is limiting our access right now. We retried automatically a few times — please wait a minute and try again.';
        // Start a 90s client-side cooldown so further taps/retries
        // don't extend the server's IP ban.
        rateLimitedUntilRef.current = Date.now() + 90000;
      } else if (status === 503) {
        title = serverData?.error || 'Could Not Load Video';
        message = serverData?.message || "We're having trouble reaching YouTube right now. Please try again in a moment.";
      } else if (!err.response) {
        title = 'No Internet';
        message = 'Could not connect to the server. Please check your internet connection.';
      }

      setYtError({ title, message });
    } finally {
      setYtLoading(false);
    }
  };

  const runDownload = async ({ kind, maxHeight, ext, label }) => {
    if (!validateYouTubeUrl(youtubeUrl) || ytDownloading) return;

    const attempt = async () => {
      setShowFormatModal(false);
      // Silent auto-retry on 429/5xx before surfacing any error popup.
      const { data: payload, error: reqError } = await withRateLimitRetry(() =>
        requestYouTubeDownload({
          url: youtubeUrl.trim(),
          kind,
          maxHeight: kind === 'video' ? maxHeight : undefined,
          audioBitrate: kind === 'audio' ? audioBitrate : undefined,
        })
      );
      if (reqError) throw reqError;

      if (!payload.downloadUrl) {
        throw new Error('The server did not return a download link. Please try again.');
      }

      const fileName = `youtube_${Date.now()}.${ext}`;
      const result = await startBackgroundDownload(
        payload.downloadUrl, 
        fileName, 
        (p) => setYtDownloadProgress(p),
        {
          title: ytInfo?.title || 'YouTube Video',
          platform: 'youtube',
          format: label,
          thumbnail: ytInfo?.thumbnail || null,
        }
      );
      if (result.success) {
        showAlert('Saved!', `${label} saved to your gallery.`);
      }
    };

    setYtDownloading(true);
    setYtDownloadProgress(null);
    setYtError(null);

    try {
      await attempt();
    } catch (err) {
      const serverData = err.response?.data;
      const status = err.response?.status;

      let title = serverData?.error || 'Download Did Not Work';
      let message = serverData?.message || err.message || "We couldn't download this video. Please try again.";

      if (status === 429) {
        title = serverData?.error || 'YouTube is Busy';
        message = serverData?.message || 'YouTube is limiting our access right now. We retried automatically a few times — please wait a minute and try again.';
      } else if (!err.response) {
        title = 'No Internet';
        message = 'Could not connect to the server. Please check your internet connection.';
      }

      showAlert(title, message, [
        { text: 'OK', style: 'cancel' },
        {
          text: 'Try Again',
          onPress: async () => {
            try {
              setYtDownloading(true);
              setYtDownloadProgress(null);
              await attempt();
            } catch (e2) {
              const retryMsg = e2.response?.data?.message || e2.message || "It still didn't work. Please try again later.";
              showAlert('Still Not Working', retryMsg);
            } finally {
              setYtDownloading(false);
              setYtDownloadProgress(null);
            }
          },
        },
      ]);
    } finally {
      setYtDownloading(false);
    }
  };

  const videoOptions = Array.isArray(ytInfo?.videoOptions) ? ytInfo.videoOptions : [];
  const thumbnailUrl = ytInfo?.thumbnail || (ytInfo?.videoId ? `https://img.youtube.com/vi/${ytInfo.videoId}/maxresdefault.jpg` : '');

  return (
    <View style={styles.container}>
      {/* Navbar: back arrow + YouTube title */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft color={COLORS.text} size={22} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>YouTube</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>YouTube Downloader.</Text>
          <Text style={styles.heroSub}>
            Paste a link and fetch video details to select MP4 video or MP3 audio format.
          </Text>
        </View>

        {/* Input Card */}
        <View style={styles.extractionCard}>
          <CustomInput
            placeholder="Paste YouTube link"
            value={youtubeUrl}
            onChangeText={(text) => {
              clearPendingAutoFetch();
              setYoutubeUrl(text);
              setYtError(null);
              setYtInfo(null);
            }}
            onClear={() => {
              clearPendingAutoFetch();
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
            style={[styles.fetchBtn, (ytLoading || ytDownloading) && { opacity: 0.7 }]}
            onPress={handleFetch}
            disabled={ytLoading || ytDownloading}
            activeOpacity={0.85}
          >
            {ytLoading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.fetchBtnText}>FETCH VIDEO</Text>
            )}
          </TouchableOpacity>

          {ytError && (
            <View style={styles.errorCard}>
              <View style={styles.errorIconHeader}>
                <Shield color={COLORS.primary} size={16} />
                <Text style={styles.errorTitle}>{ytError.title}</Text>
              </View>
              <Text style={styles.errorBody}>{ytError.message}</Text>
            </View>
          )}
        </View>

        {/* Video Preview Card */}
        {ytInfo ? (
          <View style={styles.previewContainer}>
            <TouchableOpacity
              style={styles.thumbnailWrapper}
              activeOpacity={0.9}
              onPress={() => {
                if (youtubeUrl) Linking.openURL(youtubeUrl.trim());
              }}
            >
              <Image
                source={{ uri: thumbnailUrl }}
                style={styles.thumbnailImage}
                resizeMode="cover"
              />
              <View style={styles.playOverlay}>
                <View style={styles.amberCircle}>
                  <Download color="#000" size={24} />
                </View>
                <Text style={styles.playText}>Tap to open on YouTube</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.metaCard}>
              <Text style={styles.metaTitle} numberOfLines={2}>{ytInfo.title || 'YouTube Video'}</Text>
              {!!ytInfo.duration && <Text style={styles.metaSubtitle}>Duration: {ytInfo.duration}</Text>}
              
              <TouchableOpacity
                style={styles.chooseFormatBtn}
                onPress={() => setShowFormatModal(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.chooseFormatBtnText}>Choose Format</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky DownloadProgressBar above tab bar when ytDownloading */}
      {ytDownloading && (
        <View style={styles.stickyDownloadContainer}>
          <DownloadProgressBar progress={ytDownloadProgress} />
        </View>
      )}

      {/* Bottom Sheet Modal */}
      <Modal
        visible={showFormatModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFormatModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          onPress={() => setShowFormatModal(false)} 
          activeOpacity={1} 
        />
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />
          
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
            <View style={styles.modalContent}>
              <Text style={styles.modalSectionTitle}>Video Qualities</Text>
              <Text style={styles.modalHint}>Select preferred quality to download MP4.</Text>
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
                  activeOpacity={0.8}
                >
                  <Text style={styles.formatRowText}>{opt.label}</Text>
                  <Download color={COLORS.primary} size={18} />
                </TouchableOpacity>
              ))}

              <Text style={[styles.modalSectionTitle, { marginTop: 20 }]}>Audio Only</Text>
              <Text style={styles.modalHint}>Choose bitrate, then download MP3.</Text>
              <View style={styles.bitrateRow}>
                {['128', '192', '320'].map((b) => (
                  <TouchableOpacity
                    key={b}
                    style={[styles.bitrateChip, audioBitrate === b && styles.bitrateChipSelected]}
                    onPress={() => setAudioBitrate(b)}
                    disabled={ytDownloading}
                  >
                    <Text style={[styles.bitrateText, audioBitrate === b && styles.bitrateTextSelected]}>
                      {b} kbps
                    </Text>
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
                activeOpacity={0.85}
              >
                <Download color="#000" size={18} style={{ marginRight: 8 }} />
                <Text style={styles.audioDownloadBtnText}>Download MP3</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
  },
  navTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 110,
  },
  heroSection: {
    marginTop: 12,
    marginBottom: 20,
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18,
  },
  extractionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  inlinePasteBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pasteBubbleText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '700',
  },
  fetchBtn: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: 50,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    ...SHADOWS.primary,
  },
  fetchBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  errorCard: {
    backgroundColor: COLORS.amberGlass,
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.amberBorder,
  },
  errorIconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  errorTitle: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  errorBody: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  previewContainer: {
    marginTop: 4,
    marginBottom: 16,
  },
  thumbnailWrapper: {
    width: '100%',
    aspectRatio: 16 / 9, // aspectRatio 16/9
    borderRadius: 20, // radius 20px
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  amberCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.primary, // amber background circle with Download icon
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    ...SHADOWS.primary,
  },
  playText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '700',
  },
  metaCard: {
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metaTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  metaSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 14,
  },
  chooseFormatBtn: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: 50,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.primary,
  },
  chooseFormatBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },
  stickyDownloadContainer: {
    position: 'absolute',
    bottom: 92, // Sticky above floating tab bar
    left: 16,
    right: 16,
    zIndex: 100,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface, // #161618
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '78%',
    paddingTop: 12,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalContent: {
    paddingHorizontal: 16,
  },
  modalSectionTitle: {
    color: COLORS.primary, // amber section title
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  modalHint: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceLight, // COLORS.surfaceLight bg
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  formatRowDisabled: {
    opacity: 0.5,
  },
  formatRowText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  bitrateRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  bitrateChip: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
  },
  bitrateChipSelected: {
    borderColor: COLORS.primary, // amber border when selected
    backgroundColor: COLORS.amberGlass,
  },
  bitrateText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  bitrateTextSelected: {
    color: COLORS.primary,
  },
  audioDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: 50,
    ...SHADOWS.primary,
  },
  audioDownloadBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
});
