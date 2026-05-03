import React, { useEffect } from 'react';

import { NavigationContainer, DarkTheme, useNavigationContainerRef } from '@react-navigation/native';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LayoutGrid, Search, Heart, Play, Video } from 'lucide-react-native';
import HomeScreen from './screens/HomeScreen';
import ReelDownloaderScreen from './screens/ReelDownloaderScreen';
import StoryViewerScreen from './screens/StoryViewerScreen';
import YouTubeDownloaderScreen from './screens/YouTubeDownloaderScreen';
import AboutScreen from './screens/AboutScreen';
import InAppPlayerScreen from './screens/InAppPlayerScreen';
import { COLORS } from './constants/Theme';
import api from './services/api';
import { extractUrlFromText, getNavigationTarget } from './utils/urlParser';

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

import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { setupNotificationChannel, requestNotificationPermission } from './services/notificationService';

export default function App() {
  useEffect(() => {
    // Request MediaLibrary permission ONCE on first launch — never again
    const requestPermissions = async () => {
      try {
        await setupNotificationChannel();
        await requestNotificationPermission();

        // Check if already granted (no popup)
        const { status: existing } = await MediaLibrary.getPermissionsAsync(true);
        if (existing === 'granted') {
          await AsyncStorage.setItem('hasAskedMediaPerm', 'true');
          return;
        }

        // Only show the system dialog if we've never asked before
        const hasAsked = await AsyncStorage.getItem('hasAskedMediaPerm');
        if (!hasAsked) {
          await MediaLibrary.requestPermissionsAsync(true);
          // Mark as asked regardless of result — never prompt again
          await AsyncStorage.setItem('hasAskedMediaPerm', 'true');
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

      // Extract clean URL from shared text (Instagram/YouTube sometimes include extra text)
      const cleanUrl = extractUrlFromText(rawUrl);
      const target = getNavigationTarget(cleanUrl);
      if (!target) return;

      // Wait for navigation to be ready, then route to the correct screen
      setTimeout(() => {
        if (navigationRef.isReady()) {
          navigationRef.navigate(target.screen, target.params);
        }
      }, 800);
    };

    // Handle when app was CLOSED and opened via share intent
    Linking.getInitialURL().then(url => {
      if (url) handleIncomingURL(url);
    });

    // Handle when app was in BACKGROUND and brought to foreground via share
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleIncomingURL(url);
    });
    
    return () => subscription.remove();
  }, []);

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
            height: 100,
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            elevation: 0,
            paddingHorizontal: 10,
            justifyContent: 'space-evenly'
          },
          tabBarItemStyle: {
            justifyContent: 'center',
            alignItems: 'center',
            paddingTop: 10,
            flex: 1,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '800',
            letterSpacing: 0.5,
            marginTop: 2,
            marginBottom: 28, // Pushes labels up to leave room for Shahid text
          },
          tabBarBackground: () => (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(21, 21, 24, 0.98)', borderTopLeftRadius: 30, borderTopRightRadius: 30 }]}>
              <View style={{ position: 'absolute', bottom: 15, left: 0, right: 0, alignItems: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.15)', fontSize: 12, letterSpacing: 1, fontWeight: 'bold' }}>
                  MADE BY SHAHID ANSARI
                </Text>
              </View>
            </View>
          ),
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textSecondary,
          tabBarShowLabel: true,
          tabBarIcon: ({ color, size, focused }) => {
            let Icon;
            if (route.name === 'Home') Icon = LayoutGrid;
            else if (route.name === 'Reels') Icon = Video;
            else if (route.name === 'YouTube') Icon = Play;
            else Icon = Heart;

            return (
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={24} color={color} />
                {focused && (
                  <View 
                    style={{ 
                      width: 4, 
                      height: 4, 
                      borderRadius: 2, 
                      backgroundColor: COLORS.primary, 
                      position: 'absolute',
                      top: -10,
                      alignSelf: 'center',
                    }} 
                  />
                )}
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
            tabBarItemStyle: { display: 'none', width: 0, height: 0 },
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
