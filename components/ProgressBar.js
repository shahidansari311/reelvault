import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS, RADII, FONTS } from '../constants/Theme';

export const ProgressBar = ({ progress = 0, label = 'Processing...' }) => {
  const animatedWidth = useRef(new Animated.Value(0)).current;

  const validProgress = !progress || isNaN(progress) ? 0 : Math.min(1, Math.max(0, progress));

  useEffect(() => {
    Animated.spring(animatedWidth, {
      toValue: validProgress,
      useNativeDriver: false,
      friction: 8,
      tension: 40,
    }).start();
  }, [validProgress]);

  const percent = Math.round(validProgress * 100);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.percent}>{percent}%</Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: animatedWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: RADII.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.amberBorder,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sm,
    fontWeight: '600',
  },
  percent: {
    color: COLORS.primary,
    fontSize: FONTS.md,
    fontWeight: '800',
  },
  track: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
});

export default ProgressBar;
