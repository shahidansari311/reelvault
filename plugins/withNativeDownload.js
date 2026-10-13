const {
  withDangerousMod,
  withMainApplication,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Preserves the custom NativeDownload (DownloadManager) module across
 * `expo prebuild --clean` / EAS builds.
 *
 * android/ is gitignored (CNG), so without this plugin a clean prebuild
 * wipes NativeDownloadModule.kt and the app silently loses background
 * downloads. This plugin copies the tracked sources from
 * plugins/native-download/ into the generated project and registers
 * the package in MainApplication.
 */
function withNativeDownload(config) {
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const pkgDir = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/java/com/shahid310/reelvault'
      );
      await fs.promises.mkdir(pkgDir, { recursive: true });
      for (const file of ['NativeDownloadModule.kt', 'NativeDownloadPackage.kt']) {
        const src = path.join(projectRoot, 'plugins/native-download', file);
        const dest = path.join(pkgDir, file);
        await fs.promises.copyFile(src, dest);
      }
      return config;
    },
  ]);

  config = withMainApplication(config, (config) => {
    let contents = config.modResults.contents;
    if (!contents.includes('NativeDownloadPackage()')) {
      // Ensure import exists
      if (!contents.includes('com.shahid310.reelvault.NativeDownloadPackage')) {
        contents = contents.replace(
          /import expo\.modules\.ReactNativeHostWrapper/,
          'import com.shahid310.reelvault.NativeDownloadPackage\nimport expo.modules.ReactNativeHostWrapper'
        );
      }
      // Register package alongside autolinked ones
      contents = contents.replace(
        /PackageList\(this\)\.packages\.apply\s*\{/,
        'PackageList(this).packages.apply {\n              add(NativeDownloadPackage())'
      );
      // Fallback: append before closing of getPackages if pattern differs
      if (!contents.includes('NativeDownloadPackage()')) {
        console.warn(
          '[withNativeDownload] Could not patch MainApplication automatically.'
        );
      }
      config.modResults.contents = contents;
    }
    return config;
  });

  return config;
}

module.exports = withNativeDownload;
