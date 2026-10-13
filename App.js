import React, { useEffect, useRef, useCallback, useState } from 'react';
import { NavigationContainer, DarkTheme, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, Pressable, Animated, StyleSheet, Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LayoutGrid, Video, Play, Eye } from 'lucide-react-native';
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

/* ------------------------------------------------------------------ */
/* Custom floating tab bar                                             */
/* ------------------------------------------------------------------ */

// Routes that appear in the bar. Everything else stays reachable via
// navigation.navigate() but never gets a slot.
const TABS = {
  Home: { Icon: LayoutGrid, label: 'Home' },
  Reels: { Icon: Video, label: 'Reels' },
  YouTube: { Icon: Play, label: 'YouTube' },
  Stories: { Icon: Eye, label: 'Stories' },
};

// Screens where the whole bar is hidden (full-screen experiences).
const HIDE_ON = ['Player'];

const BAR_HEIGHT = 68;
const PILL_HEIGHT = 46;
const ICON_SIZE = 22;

function TabItem({ focused, label, Icon, onPress, onLongPress, accessibilityLabel }) {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: focused ? 1 : 0,
      useNativeDriver: false, // animating flex/width, so no native driver
      friction: 9,
      tension: 80,
    }).start();
  }, [focused, progress]);

  const flex = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 2.3] });
  const bg = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0)', COLORS.primary],
  });
  const labelOpacity = progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] });
  const labelWidth = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 62] });

  return (
    <Animated.View style={[tabStyles.itemWrap, { flex }]}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : {}}
        accessibilityLabel={accessibilityLabel}
        android_ripple={{ color: 'rgba(255,255,255,0.08)', borderless: true, radius: 30 }}
        style={tabStyles.pressable}
      >
        <Animated.View style={[tabStyles.pill, { backgroundColor: bg }]}>
          <Icon
            size={ICON_SIZE}
            color={focused ? '#000' : COLORS.textSecondary}
            strokeWidth={focused ? 2.5 : 2}
          />
          <Animated.View style={{ width: labelWidth, opacity: labelOpacity, overflow: 'hidden' }}>
            <Text numberOfLines={1} style={tabStyles.label}>
              {label}
            </Text>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const activeRoute = state.routes[state.index];
  if (keyboardOpen || HIDE_ON.includes(activeRoute.name)) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[tabStyles.container, { bottom: Math.max(insets.bottom, 12) + 4 }]}
    >
      <View style={tabStyles.bar}>
        {state.routes.map((route, index) => {
          const tab = TABS[route.name];
          if (!tab) return null; // hidden route: no slot at all

          const { options } = descriptors[route.key];
          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <TabItem
              key={route.key}
              focused={focused}
              label={tab.label}
              Icon={tab.Icon}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityLabel={options.tabBarAccessibilityLabel || tab.label}
            />
          );
        })}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

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
        tabBar={(props) => <CustomTabBar {...props} />}
        detachInactiveScreens
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          freezeOnBlur: true,
          lazy: true,
          // Tells the navigator not to reserve layout space for the floating bar
          tabBarStyle: { position: 'absolute' },
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Reels" component={ReelDownloaderScreen} />
        <Tab.Screen name="YouTube" component={YouTubeDownloaderScreen} />
        <Tab.Screen name="Stories" component={StoryViewerScreen} />
        {/* Hidden routes: CustomTabBar skips them, but navigate('History') etc. still works */}
        <Tab.Screen name="History" component={HistoryScreen} />
        <Tab.Screen name="Player" component={InAppPlayerScreen} />
        <Tab.Screen name="About" component={AboutScreen} />
      </Tab.Navigator>
      <ThemedAlert />
    </NavigationContainer>
  );
}

const tabStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: BAR_HEIGHT,
    paddingHorizontal: 10,
    backgroundColor: '#1A1A1E',
    borderRadius: BAR_HEIGHT / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    elevation: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  itemWrap: {
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressable: {
    width: '100%',
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    height: PILL_HEIGHT,
    minWidth: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginLeft: 8,
    color: '#000',
    fontSize: 13,
    fontWeight: '700',
  },
});