const path = require('path');

const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Native build output, kept out of the module graph.
 *
 * Without Watchman, Metro falls back to a recursive `fs.watch` crawl. Gradle
 * creates and deletes CMake scratch directories under `.cxx/` while it builds —
 * including inside `node_modules/react-native-screens/android` — and the crawler
 * dies with ENOENT when one vanishes between the readdir and the watch.
 * `@expo/metro-config` excluded these paths for us; the bare config does not.
 *
 * Written out rather than imported from `metro-config`'s internals, which are
 * only reachable through a private subpath that moves between versions.
 */
const SEP = path.sep === '\\' ? '\\\\' : '/';
const NATIVE_OUTPUT = [
  `\\.cxx${SEP}`,
  `android${SEP}build${SEP}`,
  `android${SEP}app${SEP}build${SEP}`,
  `android${SEP}\\.gradle${SEP}`,
  `ios${SEP}build${SEP}`,
  `ios${SEP}Pods${SEP}`,
  `vendor${SEP}bundle${SEP}`,
  // Metro's own default exclusion, preserved since we replace blockList.
  `__tests__${SEP}`,
];

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    blockList: new RegExp(`(${NATIVE_OUTPUT.map((p) => `${p}.*`).join('|')})$`),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
