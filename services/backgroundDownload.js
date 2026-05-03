import { downloadFile } from '../utils/download';

export async function startBackgroundDownload(url, fileName, onProgress, meta = null) {
  try {
    // downloadFile returns a boolean and expects a progress float between 0.0 and 1.0
    const wrappedProgress = (progressVal) => {
      if (onProgress) {
        if (typeof progressVal === 'number') {
          onProgress({ percent: Math.round(progressVal * 100) });
        } else if (progressVal && progressVal.percent !== undefined) {
          onProgress(progressVal);
        }
      }
    };

    const success = await downloadFile(url, fileName, wrappedProgress, meta);
    return { success };
  } catch (err) {
    console.error('Background download error:', err);
    return { success: false, error: err.message };
  }
}
