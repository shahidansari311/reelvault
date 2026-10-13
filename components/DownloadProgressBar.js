import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS, RADII, FONTS } from '../constants/Theme';
import { Download } from 'lucide-react-native';

export const DownloadProgressBar = ({ progress }) => {
  const animatedWidth = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const percent = progress?.percent ?? (typeof progress === 'number' ? Math.round(progress * 100) : 0);
  const progressDecimal = percent / 100;

  useEffect(() => {
    Animated.spring(animatedWidth, {
      toValue: Math.min(1, progressDecimal),
      useNativeDriver: false,
      friction: 8,
      tension: 40,
    }).start();
  }, [progressDecimal]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Animated.View style={{ opacity: pulseAnim }}>
          <Download color={COLORS.primary} size={16} />
        </Animated.View>
        <Text style={styles.label}>Saving to device...</Text>
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
    backgroundColor: COLORS.amberGlass,
    borderRadius: RADII.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.amberBorder,
    marginTop: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sm,
    fontWeight: '600',
    flex: 1,
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

export default DownloadProgressBar;
