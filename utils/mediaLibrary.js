/**
 * Lazy wrapper around expo-media-library.
 *
 * expo-media-library@57 requires the native `ExpoMediaLibraryNext` module at
 * import time, which throws at startup inside old Expo Go clients or stale
 * dev builds ("Cannot find native module 'ExpoMediaLibraryNext'").
 * Deferring the require until first use lets the app boot everywhere and
 * degrade gracefully where the native module is missing (gallery features
 * report unavailability instead of redboxing the whole app).
 */

let cached = null;

export function getMediaLibrary() {
  if (cached) return cached.__unavailable ? null : cached;
  try {
    // Static string so Metro can still resolve/bundle it.
    cached = require('expo-media-library');
    return cached;
  } catch (e) {
    console.warn(
      'expo-media-library native module unavailable:',
      e?.message || e
    );
    cached = { __unavailable: true };
    return null;
  }
}

export function isMediaLibraryAvailable() {
  return getMediaLibrary() !== null;
}
