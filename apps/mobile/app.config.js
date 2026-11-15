// Dynamic additions on top of app.json (used by CI).
// EXPO_BASE_URL: sub-path for the web build, e.g. "/ChessOpenApp" on GitHub Pages.
// ANDROID_VERSION_CODE: monotonically increasing build number for APK/AAB.
module.exports = ({ config }) => {
  const versionCode = Number(process.env.ANDROID_VERSION_CODE);
  return {
    ...config,
    android: {
      ...config.android,
      ...(Number.isInteger(versionCode) && versionCode > 0 ? { versionCode } : {}),
    },
    experiments: {
      ...config.experiments,
      ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
    },
  };
};
