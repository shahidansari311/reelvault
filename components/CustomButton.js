import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SHADOWS, SPACING } from '../constants/Theme';

export const CustomButton = ({ 
  onPress, 
  title, 
  loading, 
  disabled, 
  colors = [COLORS.primary, COLORS.secondary],
  icon: Icon,
  style
}) => {
  return (
    <TouchableOpacity 
      style={[styles.button, style]} 
      onPress={onPress}
      disabled={loading || disabled}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {Icon && <Icon color="#000" size={20} style={{ marginRight: 10 }} />}
            <Text style={styles.text}>{title}</Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: 60,
    borderRadius: 20,
    overflow: 'hidden',
    ...SHADOWS.primary,
  },
  gradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#000',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
