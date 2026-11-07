#!/usr/bin/env node
// Usage: seed-ios.mjs <udid> <seed.json> — writes the seed into the app's AsyncStorage (app must be stopped).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const [udid, seedPath] = process.argv.slice(2);
const container = execFileSync('xcrun', ['simctl', 'get_app_container', udid, 'com.muscle-os.app', 'data']).toString().trim();
const dir = path.join(container, 'Library/Application Support/com.muscle-os.app/RCTAsyncLocalStorage_V1');
mkdirSync(dir, { recursive: true });
const manifestPath = path.join(dir, 'manifest.json');
let manifest = {};
try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch {}
delete manifest.muscleos_active_workout;
Object.assign(manifest, JSON.parse(readFileSync(seedPath, 'utf8')));
writeFileSync(manifestPath, JSON.stringify(manifest));
