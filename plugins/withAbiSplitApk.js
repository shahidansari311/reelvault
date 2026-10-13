const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * ABI split for smaller APKs (all profiles).
 *
 * Limits APKs to arm64-v8a only instead of bundling every ABI
 * (arm64-v8a + armeabi-v7a + x86_64). Virtually all modern phones are
 * arm64, so each APK is roughly half the size.
 *
 * App Bundles (.aab / Play Store) are unaffected — bundletool/Play
 * generates its own splits and ignores this block.
 */
function withAbiSplitApk(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;
    if (contents.includes('SPLIT_ABI_APK')) {
      return config; // already applied
    }
    contents = contents.replace(
      /android\s*\{/,
      `android {
    // SPLIT_ABI_APK: single-ABI (arm64) build for smaller APKs
    splits {
        abi {
            enable true
            reset()
            include 'arm64-v8a'
            universalApk false
        }
    }`
    );
    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withAbiSplitApk;
