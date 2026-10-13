/**
 * Themed replacement for React Native's Alert.alert.
 *
 * Same signature: showAlert(title, message, buttons?).
 * Rendered by <ThemedAlert /> (mounted once at the app root), styled in
 * the SaveX dark + amber theme. Falls back to the native Alert if called
 * before the provider has mounted (e.g. very early startup).
 */

let showFn = null;

export function registerThemedAlert(fn) {
  showFn = fn;
}

export function showAlert(title, message, buttons) {
  if (showFn) {
    showFn(title, message, buttons);
    return;
  }
  const { Alert } = require('react-native');
  Alert.alert(title, message, buttons);
}
