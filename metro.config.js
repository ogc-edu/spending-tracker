// Drizzle Expo SQLite migrations pipeline (plan 002): .sql files are imported
// by the generated drizzle/migrations.js bundle; Metro must resolve them and
// babel-plugin-inline-import inlines their content as strings at build time.
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('sql'); // <--- add this

module.exports = config;