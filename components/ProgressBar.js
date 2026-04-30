import React from 'react';
import { StyleSheet, View, Text, Animated, Easing } from 'react-native';

import { COLORS } from '../constants/Theme';

export const ProgressBar = ({ progress, label }) => {
  const animatedWidth = React.useRef(new Animated.Value(0)).current;
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const validProgress = isNaN(progress) || !isFinite(progress) ? 0 : Math.min(1, Math.max(0, progress));
    Animated.timing(animatedWidth, {
      toValue: validProgress,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // Subtle shimmer loop
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const width = animatedWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
  });

  const displayProgress = Math.round((isNaN(progress) ? 0 : Math.min(1, Math.max(0, progress))) * 100);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.percentage}>{displayProgress}%</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width, opacity: shimmerOpacity }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  percentage: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  track: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
});
