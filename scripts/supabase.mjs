#!/usr/bin/env node
/**
 * Run Supabase CLI with env loaded from supabase/.env
 *
 * Usage:
 *   node scripts/supabase.mjs db push
 *   node scripts/supabase.mjs link --project-ref <ref>
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT, 'supabase', '.env');

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(ENV_FILE);

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/supabase.mjs <supabase-cli-args...>');
  process.exit(1);
}

if (args[0] === 'link') {
  const ref = process.env.SUPABASE_PROJECT_REF?.trim();
  if (ref && !args.includes('--project-ref')) {
    args.push('--project-ref', ref);
  }
  if (!process.env.SUPABASE_DB_PASSWORD?.trim()) {
    console.warn('Tip: set SUPABASE_DB_PASSWORD in supabase/.env to skip the password prompt.');
  }
}

const result = spawnSync('pnpm', ['exec', 'supabase', ...args], {
  cwd: ROOT,
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
