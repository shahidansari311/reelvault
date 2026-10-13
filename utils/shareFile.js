import * as FileSystem from 'expo-file-system/legacy';
import { showAlert } from './alert';

// expo-sharing's native module is only present in builds made after the
// package was installed. Guard so a stale binary can't crash at startup.
function getSharing() {
  try {
    const mod = require('expo-sharing');
    return mod?.default ?? mod;
  } catch (e) {
    console.log('expo-sharing unavailable on this build — use rebuild for file sharing');
    return null;
  }
}

const mimeFor = (path) => {
  const lower = (path || '').toLowerCase();
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (/\.(m4a|aac)$/.test(lower)) return 'audio/mp4';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (/\.(ogg|opus)$/.test(lower)) return 'audio/ogg';
  if (/\.(jpg|jpeg)$/.test(lower)) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  return 'video/mp4';
};

/**
 * Share a downloaded media file (video or audio) with the system sheet.
 * The caption doubles as the chooser title — note Android lets the target
 * app (e.g. WhatsApp) add its own caption to the received file.
 */
export async function shareMediaFile(filepath, title) {
  if (!filepath) {
    showAlert('Nothing to Share', 'No file found for this item.');
    return false;
  }
  const S = getSharing();
  if (!S) {
    showAlert(
      'Update Required',
      'File sharing needs a fresh app build. Please install the latest build, then try again.'
    );
    return false;
  }
  try {
    if (!(await S.isAvailableAsync())) {
      showAlert('Sharing Unavailable', 'Sharing is not available on this device.');
      return false;
    }

    const opts = {
      mimeType: mimeFor(filepath),
      dialogTitle: title ? `Share • ${title}` : 'Share via SaveX',
    };

    // Files under public Downloads / content:// URIs aren't directly
    // shareable via FileProvider — stage a cache copy and share that.
    const needsStaging =
      filepath.startsWith('content://') || filepath.includes('/Download/');

    if (!needsStaging) {
      try {
        await S.shareAsync(filepath, opts);
        return true;
      } catch (firstErr) {
        if (/dismis|cancel/i.test(String(firstErr?.message || ''))) return false;
        // Fall through to staged retry below.
      }
    }

    const fileName = (filepath.split('/').pop() || 'media').split('?')[0];
    const staged = `${FileSystem.cacheDirectory}share_${Date.now()}_${fileName}`;
    await FileSystem.copyAsync({ from: filepath, to: staged });
    await S.shareAsync(staged, opts);
    return true;
  } catch (e) {
    if (/dismis|cancel/i.test(String(e?.message || ''))) return false;
    console.warn('shareMediaFile failed:', e);
    showAlert('Could Not Share', 'This file could not be shared. Please try again.');
    return false;
  }
}
