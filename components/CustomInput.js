import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { COLORS, SPACING, SHADOWS } from '../constants/Theme';

export const CustomInput = ({ 
  value, 
  onChangeText, 
  placeholder, 
  icon: Icon, 
  onClear,
  suffix: Suffix,
  ...props 
}) => {
  return (
    <View style={styles.container}>
      {Icon && <Icon color={COLORS.textSecondary} size={18} style={styles.icon} />}
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.3)"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        {...props}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {value.length > 0 && onClear && (
          <TouchableOpacity onPress={onClear} style={{ marginRight: 12 }}>
            <Trash2 color={COLORS.textSecondary} size={18} />
          </TouchableOpacity>
        )}
        {Suffix && <Suffix />}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 60,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...SHADOWS.glass,
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    height: '100%',
  },
});
