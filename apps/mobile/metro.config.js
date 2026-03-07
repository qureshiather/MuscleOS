/**
 * Load .env before Metro runs so EXPO_PUBLIC_* are in process.env when the
 * bundle is built (and inlined into the app).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
module.exports = config;
