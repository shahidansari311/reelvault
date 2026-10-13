import React, { useEffect, useRef, useCallback } from 'react';
import {
  NavigationContainer,
  DarkTheme,
  useNavigationContainerRef,
  useNavigationState,
  useFocused,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  LayoutGrid,
  Video,
  Play,
  Eye,
  Home,
  Video as VideoIcon,
  Play as PlayIcon,
  Eye as EyeIcon,
  Archive,
  PlayCircle,
  Info,
} from 'lucide-react-native';
import { getMediaLibrary } from './utils/mediaLibrary';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';

import HomeScreen from './screens/HomeScreen';
import ReelDownloaderScreen from './screens/ReelDownloaderScreen';
import StoryViewerScreen from './screens/StoryViewerScreen';
import YouTubeDownloaderScreen from './screens/YouTubeDownloaderScreen';
import HistoryScreen from './screens/HistoryScreen';
import AboutScreen from './screens/AboutScreen';
import InAppPlayerScreen from './screens/InAppPlayerScreen';
import { COLORS } from './constants/Theme';
import api from './services/api';
import { extractUrlFromText, getNavigationTarget } from './utils/urlParser';
import { setupNotificationChannel, requestNotificationPermission } from './services/notificationService';
import ThemedAlert from './components/ThemedAlert';
import { showAlert } from './utils/alert';

const Tab = createBottomTabNavigator();

const MyDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: COLORS.background,
    card: COLORS.background,
    text: COLORS.text,
    border: 'transparent',
    notification: COLORS.primary,
  },
};

export default function App() {
  useEffect(() => {
    // Request MediaLibrary permission ONCE on first launch — never again
    const requestPermissions = async () => {
      try {
        await setupNotificationChannel();
        await requestNotificationPermission();

        // Check if already granted (no popup). Skipped entirely where the
        // native media-library module is missing (old Expo Go / stale build).
        const MediaLibrary = getMediaLibrary();
        if (!MediaLibrary) {
          await AsyncStorage.setItem('hasAskedMediaPerm', 'true');
        } else {
          const { status: existing } = await MediaLibrary.getPermissionsAsync(true);
          if (existing !== 'granted') {
            // Only show the system dialog if we've never asked before
            const hasAsked = await AsyncStorage.getItem('hasAskedMediaPerm');
            if (!hasAsked) {
              await MediaLibrary.requestPermissionsAsync(true);
              await AsyncStorage.setItem('hasAskedMediaPerm', 'true');
            }
          } else {
            await AsyncStorage.setItem('hasAskedMediaPerm', 'true');
          }
        }

        // Ask for download folder ONCE on first launch
        if (Platform.OS === 'android') {
          const { getOrInitBaseFolderUri } = require('./utils/download');
          const hasFolder = await AsyncStorage.getItem('savex_base_folder_uri');
          if (!hasFolder) {
            // Show friendly alert first, then open picker
            showAlert(
              'Choose Download Folder',
              'SaveX will save your downloads in organized folders. Please select a base folder once.',
              [
                {
                  text: 'Choose Folder',
                  onPress: async () => {
                    await getOrInitBaseFolderUri();
                  },
                },
              ]
            );
          }
        }
      } catch (err) {
        console.log('Permission request error:', err);
      }
    };
    requestPermissions();

    const keepAlive = setInterval(async () => {
      try {
        await api.get('/');
      } catch (e) {
        // Silently fail
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(keepAlive);
  }, []);

  const navigationRef = useNavigationContainerRef();

  // Shared links can arrive before the navigator is ready (cold start via
  // share intent). Stash the raw value and flush it once ready — plus a
  // lightweight poller as backstop — so a share is never silently dropped.
  const pendingSharedUrl = useRef(null);

  const flushPendingSharedUrl = useCallback(() => {
    const rawUrl = pendingSharedUrl.current;
    if (!rawUrl) return;
    if (!navigationRef.isReady()) return;

    const cleanUrl = extractUrlFromText(rawUrl);
    const target = getNavigationTarget(cleanUrl);
    pendingSharedUrl.current = null;
    if (target) {
      navigationRef.navigate(target.screen, target.params);
    }
  }, [navigationRef]);

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) {
        pendingSharedUrl.current = url;
        flushPendingSharedUrl();
      }
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url) {
        pendingSharedUrl.current = url;
        flushPendingSharedUrl();
      }
    });

    const flusher = setInterval(flushPendingSharedUrl, 500);

    return () => {
      subscription.remove();
      clearInterval(flusher);
    };
  }, [navigationRef, flushPendingSharedUrl]);

  return (
    <NavigationContainer ref={navigationRef} theme={MyDarkTheme} onReady={flushPendingSharedUrl}>
      <StatusBar style="light" />
      <Tab.Navigator
        detachInactiveScreens
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          unmountOnBlur: true,
          freezeOnBlur: true,
          lazy: true,
          tabBarStyle: { display: 'none' },
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Home' }} />
        <Tab.Screen name="Reels" component={ReelDownloaderScreen} options={{ tabBarLabel: 'Reels' }} />
        <Tab.Screen name="YouTube" component={YouTubeDownloaderScreen} options={{ tabBarLabel: 'YouTube' }} />
        <Tab.Screen name="Stories" component={StoryViewerScreen} options={{ tabBarLabel: 'Stories' }} />
        <Tab.Screen name="History" component={HistoryScreen} options={{ tabBarLabel: 'History' }} />
        <Tab.Screen name="Player" component={InAppPlayerScreen} options={{ tabBarLabel: 'Player' }} />
        <Tab.Screen name="About" component={AboutScreen} options={{ tabBarLabel: 'About' }} />
      </Tab.Navigator>
      <CustomTabBar state={navigationRef.current?.getState()} navigation={navigationRef} />
      <ThemedAlert />
    </NavigationContainer>
  );
}

// --- CustomTabBar: icons aligned at the bottom (downside) of the pill ---
function CustomTabBar(props) {
  const { navigation } = props;
  const focused = useFocused();

  return (
    <View style={styles.container}>
      {navigation.getRoutes().map((route, index) => {
        const iconName =
          route.name === 'Home'
            ? 'home'
            : route.name === 'Reels'
            ? 'video'
            : route.name === 'YouTube'
            ? 'play'
            : route.name === 'Stories'
            ? 'eye'
            : route.name === 'History'
            ? 'archive'
            : route.name === 'Player'
            ? 'play-circle'
            : 'info';

        const size = focused ? 36 : 28;
        const iconColor = focused ? '#fff' : COLORS.textSecondary;

        // Position: calculate x from route order
        const tabIdx = ['Home', 'Reels', 'YouTube', 'Stories', 'History', 'Player', 'About'].indexOf(route.name);
        if (tabIdx < 0) return null;

        const tabWidth = (SCREEN_WIDTH - 32) / 8;
        const startX = 2 * tabWidth;
        const posX = startX + tabIdx * tabWidth + tabWidth / 2;

        return (
          <TouchableOpacity
            key={route.name}
            style={styles.tab}
            onPress={() => navigation.navigate(route.name)}
            accessibilityLabel={route.name}
          >
            <View style={{ ...styles.iconContainer, backgroundColor: focused ? COLORS.primary : 'transparent' }}>
              {/* Bottom indicator line only on active tab */}
              {focused && (
                <View
                  style={[
                    styles.bottomIndicator,
                    { left: posX - 14, backgroundColor: COLORS.primary },
                  ]}
                />
              )}
              <View style={styles.iconBg}>
                <Icon name={iconName} size={size} color={iconColor} />
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const SCREEN_WIDTH = Dimensions.get('window').width;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    marginHorizontal: 16,
    height: 64,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  tab: {
    width: (SCREEN_WIDTH - 32) / 8,
    height: 64,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  iconContainer: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
});
