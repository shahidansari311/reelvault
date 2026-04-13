import React from 'react';
import { StyleSheet, View, Text, Animated, Easing } from 'react-native';

import { COLORS } from '../constants/Theme';

export const ProgressBar = ({ progress, label }) => {
  const animatedWidth = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const validProgress = isNaN(progress) || !isFinite(progress) ? 0 : Math.min(1, Math.max(0, progress));
    Animated.timing(animatedWidth, {
      toValue: validProgress,
      duration: 600, // Slightly longer for smoother observation
      easing: Easing.bezier(0.33, 1, 0.68, 1), // Premium ease-out
      useNativeDriver: false,
    }).start();
  }, [progress]);



  const width = animatedWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });



  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.percentage}>{Math.round(progress * 100)}%</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width }]} />
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
