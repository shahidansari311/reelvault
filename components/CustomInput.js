import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { COLORS, RADII, FONTS } from '../constants/Theme';

export const CustomInput = ({ placeholder, value, onChangeText, onClear, icon: Icon, suffix }) => {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, focused && styles.containerFocused]}>
      {Icon && <Icon color={focused ? COLORS.primary : COLORS.textMuted} size={16} style={styles.icon} />}
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        value={value}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {!!value && (
        <TouchableOpacity onPress={onClear} style={styles.clearBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <X color={COLORS.textMuted} size={14} />
        </TouchableOpacity>
      )}
      {suffix && (typeof suffix === 'function' ? suffix() : suffix)}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: RADII.input,
    paddingHorizontal: 14,
    height: 50,
    borderWidth: 1.5,
    marginBottom: 12,
    gap: 8,
    borderColor: COLORS.border,
  },
  // Focus state via styles only — an Animated border on the container
  // forces layout on every keystroke and makes the keyboard close after
  // each letter.
  containerFocused: {
    borderColor: COLORS.primary,
  },
  icon: {
    flexShrink: 0,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONTS.md,
    height: '100%',
  },
  clearBtn: {
    padding: 4,
  },
});

export default CustomInput;
