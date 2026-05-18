module.exports = function (api) {
  api.cache(true);
  const isTest = process.env.NODE_ENV === 'test';
  return {
    presets: [
      isTest
        ? 'babel-preset-expo'
        : ["babel-preset-expo", { jsxImportSource: "nativewind" }]
    ],
    plugins: [
      // NativeWind and Reanimated plugins are only needed in dev/prod builds
      ...(!isTest ? [
        "nativewind/babel",
        // Reanimated plugin must be listed last
        "react-native-reanimated/plugin",
      ] : []),
    ],
  };
};
