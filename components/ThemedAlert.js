import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Modal,
  Animated,
} from 'react-native';
import { COLORS, SHADOWS } from '../constants/Theme';
import { registerThemedAlert } from '../utils/alert';

const normalizeButtons = (buttons) => {
  if (!buttons || buttons.length === 0) return [{ text: 'OK' }];
  return buttons;
};

/**
 * Root-level themed popup. Mount once inside the NavigationContainer —
 * every showAlert() call anywhere in the app renders here in SaveX theme.
 */
export default function ThemedAlert() {
  const [current, setCurrent] = useState(null);
  const currentRef = useRef(null);
  const queueRef = useRef([]);
  const scale = useRef(new Animated.Value(0.92)).current;
  const fade = useRef(new Animated.Value(0)).current;

  const setCurrentSync = (item) => {
    currentRef.current = item;
    setCurrent(item);
  };

  const animateIn = () => {
    scale.setValue(0.92);
    fade.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 8, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  };

  const showNext = () => {
    const next = queueRef.current.shift();
    if (next) {
      setCurrentSync(next);
      animateIn();
    } else {
      setCurrentSync(null);
    }
  };

  useEffect(() => {
    registerThemedAlert((title, message, buttons) => {
      const item = { title, message, buttons: normalizeButtons(buttons) };
      if (currentRef.current) {
        queueRef.current.push(item);
      } else {
        setCurrentSync(item);
        animateIn();
      }
    });
    return () => registerThemedAlert(null);
  }, []);

  const pressButton = (btn) => {
    // Dismiss first so a chained showAlert (e.g. retry flows) renders cleanly.
    setCurrentSync(null);
    queueRef.current = [];
    requestAnimationFrame(() => {
      try {
        btn.onPress && btn.onPress();
      } catch (e) {
        console.warn('Alert button error:', e);
      }
    });
  };

  if (!current) return null;

  const { title, message, buttons } = current;
  const primaryIndex = buttons.findIndex((b) => b.style !== 'cancel');

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => pressButton({})}>
      <TouchableWithoutFeedback onPress={() => pressButton(buttons[primaryIndex >= 0 ? primaryIndex : 0] || {})}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.card, { opacity: fade, transform: [{ scale }] }]}>
              <View style={styles.accentBar} />
              {title ? <Text style={styles.title}>{title}</Text> : null}
              {message ? <Text style={styles.message}>{message}</Text> : null}
              <View style={styles.buttons}>
                {buttons.map((btn, i) => {
                  const isPrimary = i === primaryIndex || (primaryIndex < 0 && i === 0);
                  const isDestructive = btn.style === 'destructive';
                  return (
                    <TouchableOpacity
                      key={`${btn.text}-${i}`}
                      style={[styles.btn, isPrimary ? styles.btnPrimary : styles.btnGhost]}
                      onPress={() => pressButton(btn)}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.btnText,
                          isPrimary ? styles.btnTextPrimary : styles.btnTextGhost,
                          isDestructive && !isPrimary && styles.btnTextDestructive,
                        ]}
                      >
                        {btn.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.amberBorder,
    overflow: 'hidden',
    ...SHADOWS.primary,
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: COLORS.primary,
  },
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 8,
    paddingTop: 4,
  },
  message: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  buttons: {
    gap: 10,
  },
  btn: {
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
  },
  btnGhost: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  btnTextPrimary: {
    color: '#000',
  },
  btnTextGhost: {
    color: COLORS.text,
  },
  btnTextDestructive: {
    color: COLORS.error,
  },
});
