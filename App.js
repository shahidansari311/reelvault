import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Film, Instagram } from 'lucide-react-native';
import ReelDownloaderScreen from './screens/ReelDownloaderScreen';
import StoryViewerScreen from './screens/StoryViewerScreen';
import { COLORS } from './constants/Theme';

const Tab = createBottomTabNavigator();

const MyDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: COLORS.background,
    card: COLORS.surface,
    text: COLORS.text,
    border: COLORS.border,
    notification: COLORS.primary,
  },
};

export default function App() {
  return (
    <NavigationContainer theme={MyDarkTheme}>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: COLORS.surface,
            borderTopColor: COLORS.border,
            height: 70,
            paddingBottom: 10,
            paddingTop: 10,
          },
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textSecondary,
          tabBarIcon: ({ color, size }) => {
            if (route.name === 'Reels') {
              return <Film size={size} color={color} />;
            } else if (route.name === 'Stories') {
              return <Instagram size={size} color={color} />;
            }
          },
        })}
      >
        <Tab.Screen name="Reels" component={ReelDownloaderScreen} />
        <Tab.Screen name="Stories" component={StoryViewerScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
