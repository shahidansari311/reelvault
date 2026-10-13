import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { COLORS, RADII } from '../constants/Theme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 36 - 12) / 2; // (screenWidth - paddingHorizontal*2 - gap) / 2
const CARD_HEIGHT = CARD_WIDTH * 1.5;

export const SkeletonShimmer = ({ style, children }) => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <Animated.View style={[styles.shimmerBase, style, { opacity: pulseAnim }]}>
      {children}
    </Animated.View>
  );
};

export const SkeletonBox = ({ width: w = '100%', height: h = 20, borderRadius = RADII.sm, style }) => {
  return (
    <SkeletonShimmer
      style={[
        {
          width: w,
          height: h,
          borderRadius,
          backgroundColor: COLORS.surfaceLight,
        },
        style,
      ]}
    />
  );
};

export const SkeletonStoryCard = ({ index = 0 }) => {
  const delayAnim = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(delayAnim, {
          toValue: 0.65,
          duration: 800 + (index % 3) * 100,
          useNativeDriver: true,
        }),
        Animated.timing(delayAnim, {
          toValue: 0.25,
          duration: 800 + (index % 3) * 100,
          useNativeDriver: true,
        }),
      ])
    );
    const timer = setTimeout(() => pulse.start(), (index % 4) * 120);
    return () => {
      clearTimeout(timer);
      pulse.stop();
    };
  }, [delayAnim, index]);

  return (
    <Animated.View style={[styles.storyCard, { opacity: delayAnim }]}>
      <View style={styles.storyCardThumb} />
      <View style={styles.storyCardFooter}>
        <View style={styles.storyAvatar} />
        <View style={styles.storyNamePlaceholder} />
      </View>
    </Animated.View>
  );
};

export const SkeletonGrid = ({ count = 4 }) => {
  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <View style={styles.grid}>
      {items.map((i) => (
        <SkeletonStoryCard key={`skeleton-${i}`} index={i} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  shimmerBase: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    marginTop: 8,
  },
  storyCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 12,
  },
  storyCardThumb: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  storyCardFooter: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
    backgroundColor: COLORS.surfaceLight,
  },
  storyAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  storyNamePlaceholder: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
});

export default SkeletonGrid;
