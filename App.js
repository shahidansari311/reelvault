import React, { useEffect } from 'react';
import { NavigationContainer, DarkTheme, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, Alert, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LayoutGrid, Video, Play, Eye } from 'lucide-react-native';
import * as MediaLibrary from 'expo-media-library';
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

        // Check if already granted (no popup)
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

        // Ask for download folder ONCE on first launch
        if (Platform.OS === 'android') {
          const { getOrInitBaseFolderUri } = require('./utils/download');
          const hasFolder = await AsyncStorage.getItem('savex_base_folder_uri');
          if (!hasFolder) {
            // Show friendly alert first, then open picker
            Alert.alert(
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

  useEffect(() => {
    const handleIncomingURL = (rawUrl) => {
      if (!rawUrl) return;

      const cleanUrl = extractUrlFromText(rawUrl);
      const target = getNavigationTarget(cleanUrl);
      if (!target) return;

      setTimeout(() => {
        if (navigationRef.isReady()) {
          navigationRef.navigate(target.screen, target.params);
        }
      }, 800);
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleIncomingURL(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleIncomingURL(url);
    });

    return () => subscription.remove();
  }, [navigationRef]);

  return (
    <NavigationContainer ref={navigationRef} theme={MyDarkTheme}>
      <StatusBar style="light" />
      <Tab.Navigator
        detachInactiveScreens
        screenOptions={({ route }) => ({
          headerShown: false,
          unmountOnBlur: true,
          freezeOnBlur: true,
          lazy: true,
          tabBarStyle: {
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            height: 76,
            position: 'absolute',
            bottom: 12,
            left: 0,
            right: 0,
            marginHorizontal: 12,
            elevation: 10,
            borderRadius: 28,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.08)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 14,
          },
          tabBarItemStyle: {
            justifyContent: 'center',
            alignItems: 'center',
            paddingTop: 8,
            paddingBottom: 14,
            flex: 1,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 0.3,
            marginTop: 2,
            marginBottom: 6,
          },
          tabBarBackground: () => (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: 'rgba(13, 13, 15, 0.97)',
                  borderRadius: 28,
                  overflow: 'hidden',
                },
              ]}
            >
              <View
                style={{
                  position: 'absolute',
                  bottom: 3,
                  left: 0,
                  right: 0,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    color: 'rgba(255, 255, 255, 0.12)',
                    fontSize: 10,
                    letterSpacing: 1,
                    fontWeight: '700',
                  }}
                >
                  MADE BY SHAHID ANSARI
                </Text>
              </View>
            </View>
          ),
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textSecondary,
          tabBarShowLabel: true,
          tabBarIcon: ({ color, focused }) => {
            let Icon;
            if (route.name === 'Home') Icon = LayoutGrid;
            else if (route.name === 'Reels') Icon = Video;
            else if (route.name === 'YouTube') Icon = Play;
            else if (route.name === 'Stories') Icon = Eye;
            else Icon = LayoutGrid;

            return (
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={22} color={color} />
                <View
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: focused ? COLORS.primary : 'transparent',
                    marginTop: 3,
                  }}
                />
              </View>
            );
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Home' }} />
        <Tab.Screen name="Reels" component={ReelDownloaderScreen} options={{ tabBarLabel: 'Reels' }} />
        <Tab.Screen name="YouTube" component={YouTubeDownloaderScreen} options={{ tabBarLabel: 'YouTube' }} />
        <Tab.Screen name="Stories" component={StoryViewerScreen} options={{ tabBarLabel: 'Stories' }} />
        <Tab.Screen
          name="History"
          component={HistoryScreen}
          options={{
            tabBarButton: () => null,
            tabBarStyle: { display: 'none' },
            tabBarItemStyle: { display: 'none', width: 0, height: 0 },
          }}
        />
        <Tab.Screen
          name="Player"
          component={InAppPlayerScreen}
          options={{
            tabBarButton: () => null,
            tabBarStyle: { display: 'none' },
            tabBarItemStyle: { display: 'none', width: 0, height: 0 },
          }}
        />
        <Tab.Screen
          name="About"
          component={AboutScreen}
          options={{
            tabBarButton: () => null,
            tabBarStyle: { display: 'none' },
            tabBarItemStyle: { display: 'none', width: 0, height: 0 },
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
