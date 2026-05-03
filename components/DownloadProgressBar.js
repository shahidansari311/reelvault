import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

export function DownloadProgressBar({ progress }) {
  const animWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: progress?.percent || 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress?.percent]);

  if (!progress) return null;

  const { percent, downloadedMB, totalMB } = progress;

  return (
    <View style={styles.container}>
      {/* Top row: label + percentage */}
      <View style={styles.topRow}>
        <Text style={styles.label}>DOWNLOADING...</Text>
        <Text style={styles.percent}>{percent}%</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.barBg}>
        <Animated.View
          style={[
            styles.barFill,
            {
              width: animWidth.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      {/* Bottom row: MB downloaded / total */}
      <View style={styles.bottomRow}>
        <Text style={styles.mbText}>
          {downloadedMB} MB / {totalMB} MB
        </Text>
        <Text style={styles.mbText}>
          {totalMB > 0 ? `${(totalMB - downloadedMB).toFixed(1)} MB left` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: { color: '#aaa', fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  percent: { color: '#E91E63', fontSize: 16, fontWeight: '700' },
  barBg: {
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#E91E63',
    borderRadius: 3,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mbText: { color: '#666', fontSize: 11 },
});
