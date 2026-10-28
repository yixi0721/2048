import { readFile, writeFile } from 'node:fs/promises';
import './build.js';

const assetIndex = 'android/app/src/main/assets/www/2048.html';
const marker = '<script type="module" src="./src/app.js"></script>';
const html = await readFile(assetIndex, 'utf8');
if (!html.includes(marker)) throw new Error('Could not find the app entry point in Android assets.');
await writeFile(assetIndex, html.replace(marker, `<script>globalThis.__UNLOCK_ALL_SKINS__ = true;</script>\n  ${marker}`), 'utf8');
console.log('Android assets prepared with all theme skins unlocked.');
