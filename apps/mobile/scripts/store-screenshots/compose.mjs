#!/usr/bin/env node
/**
 * Frames raw app captures with a device and marketing copy for the App Store and Google Play.
 *
 * Usage: compose.mjs [--dark] <ios|android> <rawDir> <outDir> [slideId...]
 * Output sizes: iOS 1320×2868 (6.9", the size App Store Connect scales down from),
 * Android 1080×1920 (9:16, which Play accepts for promotion).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLIDES } from './slides.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const mobile = path.resolve(here, '../..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const argv = process.argv.slice(2);
const dark = argv.includes('--dark');
const [platform, rawDirArg, outDirArg, ...only] = argv.filter((a) => a !== '--dark');
if (!['ios', 'android'].includes(platform) || !outDirArg) {
  throw new Error('usage: compose.mjs <ios|android> <rawDir> <outDir> [slideId...]');
}
const rawDir = path.resolve(rawDirArg);
const outDir = path.resolve(outDirArg);
mkdirSync(outDir, { recursive: true });

const SIZE = platform === 'ios' ? { w: 1320, h: 2868 } : { w: 1080, h: 1920 };
/** Design unit: everything is laid out on a 1320-wide canvas and scaled to the output width. */
const U = SIZE.w / 1320;
const canvasH = SIZE.h / U;

const fontUrl = (weight, file) =>
  `file://${path.join(mobile, 'node_modules/@expo-google-fonts/dm-sans', weight, file)}`;
const ioniconsUrl = `file://${path.join(mobile, 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf')}`;
const glyphs = JSON.parse(
  readFileSync(path.join(mobile, 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json'), 'utf8')
);
const markUrl = `file://${path.resolve(mobile, '../landing/public/brand-mark.png')}`;

const glyph = (name) => {
  if (!(name in glyphs)) throw new Error(`Unknown Ionicon: ${name}`);
  return `&#${glyphs[name]};`;
};

const iosPhone = platform === 'ios';
const PHONE_W = iosPhone ? 1000 : 860;
const SCREEN_ASPECT = iosPhone ? 2868 / 1320 : 2400 / 1080;
const BEZEL = iosPhone ? 26 : 22;
const OUTER_R = iosPhone ? 150 : 66;
const SCREEN_W = PHONE_W - BEZEL * 2;
const SCREEN_H = Math.round(SCREEN_W * SCREEN_ASPECT);
const PHONE_H = SCREEN_H + BEZEL * 2;

/** Mirrors the app's palette (src/theme/palette.ts) for the canvas around the phone. */
const T = dark
  ? {
      page: '#14161E', text: '#EDEFF5', sub: '#A8ADBD', primary: '#5694F5', screen: '#14161E',
      glow: '#2B3550', glowEnd: 'rgba(43,53,80,0)', g1: '#1B1F2C', g2: '#101219', fade: '20,22,30',
      bezel: '#23252D', bezelRing: '#555966',
      phoneShadow: '0 30px 70px rgba(0,0,0,.3)',
      card: 'rgba(37,41,54,.97)', cardShadow: '0 34px 80px rgba(0,0,0,.55),inset 0 0 0 2px rgba(255,255,255,.08)',
      well: 'rgba(86,148,245,.18)', wellText: '#7EB4FF',
    }
  : {
      page: '#EEF0F7', text: '#0C0C14', sub: '#4A4A5E', primary: '#2563EB', screen: '#F2F4FA',
      glow: '#FFFFFF', glowEnd: 'rgba(255,255,255,0)', g1: '#F4F6FB', g2: '#E3E7F1', fade: '238,240,247',
      bezel: '#0B0C10', bezelRing: '#2A2C33',
      phoneShadow: '0 60px 130px rgba(32,40,70,.28),0 18px 40px rgba(32,40,70,.16)',
      card: 'rgba(255,255,255,.96)', cardShadow: '0 34px 80px rgba(32,40,70,.24),0 6px 16px rgba(32,40,70,.1),inset 0 0 0 1px rgba(255,255,255,.9)',
      well: '#E9EFFD', wellText: '#2563EB',
    };

function html(slide) {
  const top = slide.layout === 'top';
  const textH = slide.logo ? 590 : 450;
  // How much phone is visible: from below the copy to the canvas edge, or from the edge to the copy.
  const phoneTop = top ? (iosPhone ? 150 : 60) + textH + 40 : canvasH - textH - 100 - PHONE_H;
  const callout = slide.callout
    ? `<div class="callout" style="top:${canvasH - (iosPhone ? 480 : 300)}px">
        <div class="well"><span class="ion">${glyph(slide.callout.icon)}</span></div>
        <div><div class="c-title">${slide.callout.title}</div><div class="c-sub">${slide.callout.sub}</div></div>
      </div>`
    : '';
  const bottomFade = top
    ? `<div class="fade fade-bottom" style="top:${canvasH - 520}px;height:540px"></div>`
    : '';
  const topFade = top
    ? ''
    : `<div class="fade fade-top" style="top:0;height:360px"></div>`;
  // Simulator captures already include the Dynamic Island; emulator captures have no camera cutout.
  const cutout = iosPhone ? '' : `<div class="punch"></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:DM;font-weight:700;src:url('${fontUrl('700Bold', 'DMSans_700Bold.ttf')}')}
@font-face{font-family:DM;font-weight:500;src:url('${fontUrl('500Medium', 'DMSans_500Medium.ttf')}')}
@font-face{font-family:DM;font-weight:400;src:url('${fontUrl('400Regular', 'DMSans_400Regular.ttf')}')}
@font-face{font-family:Ionicons;src:url('${ioniconsUrl}')}
*{margin:0;box-sizing:border-box}
html,body{width:${SIZE.w}px;height:${SIZE.h}px;overflow:hidden;background:${T.page}}
#stage{position:absolute;left:0;top:0;width:1320px;height:${canvasH}px;transform:scale(${U});transform-origin:0 0;
  font-family:DM,sans-serif;color:${T.text};overflow:hidden;
  background:radial-gradient(120% 70% at 50% ${top ? '0%' : '100%'},${T.glow} 0%,${T.glowEnd} 70%),
    linear-gradient(${top ? '180deg' : '0deg'},${T.g1} 0%,${T.g2} 62%,${T.page} 100%)}
.copy{position:absolute;left:70px;right:70px;text-align:center;${top ? `top:${iosPhone ? 150 : 60}px` : `bottom:${iosPhone ? 150 : 56}px`}}
.brand{display:flex;align-items:center;justify-content:center;gap:22px;margin-bottom:44px}
.mark{width:84px;height:84px;border-radius:22px;background:#2563EB;position:relative}
.mark i{position:absolute;inset:10px;background:#fff;-webkit-mask:url('${markUrl}') center/contain no-repeat;mask:url('${markUrl}') center/contain no-repeat}
.word{font-size:68px;font-weight:700;letter-spacing:-1.5px}
h1{font-size:${slide.size ?? 118}px;line-height:1.05;font-weight:700;letter-spacing:-3.5px;text-wrap:balance}
h1 em{font-style:normal;color:${T.primary}}
.sub{margin-top:30px;font-size:50px;line-height:1.28;font-weight:400;color:${T.sub};letter-spacing:-.4px;text-wrap:balance}
.phone{position:absolute;left:${(1320 - PHONE_W) / 2}px;top:${phoneTop}px;width:${PHONE_W}px;height:${PHONE_H}px;
  background:${T.bezel};border-radius:${OUTER_R}px;padding:${BEZEL}px;
  box-shadow:${T.phoneShadow},inset 0 0 0 3px ${T.bezelRing}}
.screen{position:relative;width:100%;height:100%;border-radius:${OUTER_R - BEZEL}px;overflow:hidden;background:${T.screen}}
.screen img{display:block;width:100%;height:100%;object-fit:cover;object-position:top}
.punch{position:absolute;left:50%;top:${Math.round(SCREEN_W * 0.02)}px;width:${Math.round(SCREEN_W * 0.042)}px;height:${Math.round(SCREEN_W * 0.042)}px;transform:translateX(-50%);background:#000;border-radius:999px}
.fade{position:absolute;left:0;right:0;pointer-events:none;backdrop-filter:blur(26px);-webkit-backdrop-filter:blur(26px)}
.fade-bottom{-webkit-mask:linear-gradient(180deg,transparent 0%,#000 55%);background:linear-gradient(180deg,rgba(${T.fade},0) 0%,rgba(${T.fade},.8) 62%,${T.page} 96%)}
.fade-top{-webkit-mask:linear-gradient(0deg,transparent 0%,#000 55%);background:linear-gradient(0deg,rgba(${T.fade},0) 0%,rgba(${T.fade},.85) 62%,${T.page} 96%)}
.callout{position:absolute;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:30px;padding:30px 48px 30px 30px;background:${T.card};border-radius:44px;white-space:nowrap;
  box-shadow:${T.cardShadow}}
.well{width:104px;height:104px;border-radius:30px;background:${T.well};color:${T.wellText};display:flex;align-items:center;justify-content:center}
.ion{font-family:Ionicons;font-size:58px;line-height:1}
.c-title{font-size:48px;font-weight:700;letter-spacing:-.8px}
.c-sub{font-size:37px;color:${T.sub};margin-top:6px}
</style></head><body><div id="stage">
<div class="phone"><div class="screen">
<img src="file://${path.join(rawDir, slide.shot + '.png')}" >
${cutout}
</div></div>
${bottomFade}${topFade}
<div class="copy">
${slide.logo ? `<div class="brand"><div class="mark"><i></i></div><div class="word">MuscleOS</div></div>` : ''}
<h1>${slide.title}</h1>
<div class="sub">${slide.sub}</div>
</div>
${callout}
</div>
<script>
// Place the phone from the copy's real height, so one- and two-line copy keep the same gap.
const copy = document.querySelector('.copy');
const phone = document.querySelector('.phone');
const CANVAS = ${canvasH}, GAP = ${iosPhone ? 90 : 60};
const scale = ${U};
const box = copy.getBoundingClientRect();
const copyTop = box.top / scale, copyBottom = box.bottom / scale, copyH = box.height / scale;
if (${top}) {
  phone.style.top = copyBottom + GAP + 'px';
} else if (${iosPhone}) {
  // The whole phone fits: pin it near the top and centre the copy in the space below.
  const phoneTop = 90;
  phone.style.top = phoneTop + 'px';
  const free = CANVAS - (phoneTop + ${PHONE_H});
  copy.style.bottom = 'auto';
  copy.style.top = phoneTop + ${PHONE_H} + (free - copyH) / 2 + 'px';
  document.querySelector('.fade-top').style.display = 'none';
} else {
  const phoneTop = copyTop - GAP - ${PHONE_H};
  phone.style.top = phoneTop + 'px';
  if (phoneTop >= 0) document.querySelector('.fade-top').style.display = 'none';
}
</script></body></html>`;

}

const work = path.join(tmpdir(), `store-shots-${process.pid}`);
mkdirSync(work, { recursive: true });
const profile = path.join(work, 'chrome');

for (const [i, slide] of SLIDES.entries()) {
  if (only.length && !only.includes(slide.id)) continue;
  if (!existsSync(path.join(rawDir, `${slide.shot}.png`))) {
    console.warn(`skip ${slide.id}: no ${slide.shot}.png`);
    continue;
  }
  const page = path.join(work, `${slide.id}.html`);
  writeFileSync(page, html(slide));
  const name = `${String(i + 1).padStart(2, '0')}-${slide.id}.png`;
  const target = path.join(outDir, name);
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
    `--user-data-dir=${profile}`, `--window-size=${SIZE.w},${SIZE.h}`, '--force-device-scale-factor=1',
    '--virtual-time-budget=1500', `--screenshot=${target}`, `file://${page}`,
  ], { stdio: 'ignore' });
  // App Store Connect rejects PNGs with an alpha channel.
  const flat = `${target}.tmp.png`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', target, '-pix_fmt', 'rgb24', flat]);
  rmSync(target);
  execFileSync('mv', [flat, target]);
  console.log(target);
}
rmSync(work, { recursive: true, force: true });
