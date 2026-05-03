import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications appear
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,   // dont popup during download
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// Show download started notification
export async function showDownloadStarted(fileName, notifId) {
  await Notifications.scheduleNotificationAsync({
    identifier: notifId,
    content: {
      title: '⬇ SAVEX — Download Started',
      body: `${fileName} — Starting...`,
      data: { type: 'download', notifId },
      sticky: true,        // stays until dismissed
      autoDismiss: false,
      categoryIdentifier: 'download',
      android: {
        channelId: 'downloads',
        ongoing: true,       // cannot be swiped away during download
        progress: {
          max: 100,
          current: 0,
          indeterminate: false,
        },
        // smallIcon: 'ic_download', // Use default or defined in app.json
        color: '#E91E63',
        priority: 'low',    // silent but visible
      },
    },
    trigger: null,
  });
}

// Update notification with progress
export async function updateDownloadProgress(notifId, fileName, percent, downloadedMB, totalMB) {
  await Notifications.scheduleNotificationAsync({
    identifier: notifId,
    content: {
      title: `⬇ SAVEX — ${percent}% • ${downloadedMB} MB / ${totalMB} MB`,
      body: `${fileName}`,
      data: { type: 'download', notifId },
      sticky: true,
      autoDismiss: false,
      android: {
        channelId: 'downloads',
        ongoing: true,
        progress: {
          max: 100,
          current: percent,
          indeterminate: false,
        },
        // smallIcon: 'ic_download',
        color: '#E91E63',
        priority: 'low',
      },
    },
    trigger: null,
  });
}

// Show download complete notification
export async function showDownloadComplete(notifId, fileName) {
  // Dismiss the progress notification
  await Notifications.dismissNotificationAsync(notifId);

  // Show completion notification
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '✅ Download Complete!',
      body: `${fileName} saved to SAVEX album`,
      data: { type: 'download_complete' },
      android: {
        channelId: 'downloads',
        ongoing: false,
        // smallIcon: 'ic_check',
        color: '#4CAF50',
        priority: 'default',
      },
    },
    trigger: null,
  });
}

// Show download failed notification
export async function showDownloadFailed(notifId, fileName) {
  await Notifications.dismissNotificationAsync(notifId);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '❌ Download Failed',
      body: `${fileName} — Tap to retry`,
      data: { type: 'download_failed', fileName },
      android: {
        channelId: 'downloads',
        ongoing: false,
        color: '#f44336',
        priority: 'default',
      },
    },
    trigger: null,
  });
}

// Setup notification channel (Android requires this)
export async function setupNotificationChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('downloads', {
      name: 'Downloads',
      importance: Notifications.AndroidImportance.LOW,
      vibrationPattern: null,
      lightColor: '#E91E63',
      sound: null,
      showBadge: false,
      description: 'SAVEX download progress notifications',
    });
  }
}
