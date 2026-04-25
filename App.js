import React, { useEffect } from 'react';

import { NavigationContainer, DarkTheme } from '@react-navigation/native';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LayoutGrid, Search, Heart, Play } from 'lucide-react-native';
import HomeScreen from './screens/HomeScreen';
import ReelDownloaderScreen from './screens/ReelDownloaderScreen';
import StoryViewerScreen from './screens/StoryViewerScreen';
import YouTubeDownloaderScreen from './screens/YouTubeDownloaderScreen';
import ImageDownloaderScreen from './screens/ImageDownloaderScreen';
import { COLORS } from './constants/Theme';
import api from './services/api';

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
    const keepAlive = setInterval(async () => {
      try {
        // Ping the root or a dedicated health endpoint
        await api.get('/'); 
        console.log('Keep-alive ping sent');
      } catch (e) {
        // Even if it errors (e.g. 404), it wakes up the server
        console.log('Keep-alive ping completed');
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(keepAlive);
  }, []);


  return (
    <NavigationContainer theme={MyDarkTheme}>
      <StatusBar style="light" />
      <Tab.Navigator
        detachInactiveScreens
        screenOptions={({ route }) => ({
          headerShown: false,
          unmountOnBlur: true,
          freezeOnBlur: true,
          lazy: true,
          tabBarStyle: {
            backgroundColor: 'rgba(21, 21, 24, 0.95)',
            borderTopWidth: 0,
            height: 85,
            paddingBottom: 20,
            paddingTop: 15,
            position: 'absolute',
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            elevation: 0,
          },
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textSecondary,
          tabBarShowLabel: false,
          tabBarIcon: ({ color, size, focused }) => {
            let Icon;
            if (route.name === 'Home') Icon = LayoutGrid;
            else if (route.name === 'Reels') Icon = Search;
            else if (route.name === 'YouTube') Icon = Play;
            else Icon = Heart;

            return (
              <View style={{ alignItems: 'center' }}>
                <Icon size={24} color={color} />
                {focused && (
                  <View 
                    style={{ 
                      width: 4, 
                      height: 4, 
                      borderRadius: 2, 
                      backgroundColor: COLORS.primary, 
                      marginTop: 6 
                    }} 
                  />
                )}
              </View>
            );
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Reels" component={ReelDownloaderScreen} />
        <Tab.Screen name="YouTube" component={YouTubeDownloaderScreen} />
        <Tab.Screen name="Stories" component={StoryViewerScreen} />
        <Tab.Screen 
          name="ImageDownloader" 
          component={ImageDownloaderScreen} 
          options={{ tabBarButton: () => null }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
