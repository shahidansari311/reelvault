import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { COLORS, SPACING } from '../constants/Theme';

export const CustomInput = ({ 
  value, 
  onChangeText, 
  placeholder, 
  icon: Icon, 
  onClear,
  ...props 
}) => {
  return (
    <View style={styles.container}>
      {Icon && <Icon color={COLORS.textSecondary} size={20} style={styles.icon} />}
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textSecondary}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        {...props}
      />
      {value.length > 0 && onClear && (
        <TouchableOpacity onPress={onClear}>
          <Trash2 color={COLORS.textSecondary} size={20} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingHorizontal: SPACING.md,
    height: 60,
    width: '100%',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  icon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
  },
});
