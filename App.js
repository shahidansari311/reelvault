import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LayoutGrid, Search, Heart, User } from 'lucide-react-native';
import HomeScreen from './screens/HomeScreen';
import ReelDownloaderScreen from './screens/ReelDownloaderScreen';
import StoryViewerScreen from './screens/StoryViewerScreen';
import { COLORS } from './constants/Theme';

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
  return (
    <NavigationContainer theme={MyDarkTheme}>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
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
        <Tab.Screen name="Stories" component={StoryViewerScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
