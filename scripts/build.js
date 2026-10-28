import { cp, mkdir, rm, stat } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist/src', { recursive: true });
await cp('index.html', 'dist/index.html');
await cp('2048.html', 'dist/2048.html');
await cp('minesweeper.html', 'dist/minesweeper.html');
await cp('src', 'dist/src', { recursive: true });
try {
  await stat('android/app/src/main');
  await mkdir('android/app/src/main/assets', { recursive: true });
  await rm('android/app/src/main/assets/www', { recursive: true, force: true });
  await cp('dist', 'android/app/src/main/assets/www', { recursive: true });
  console.log('Web build: dist/; Android assets: android/app/src/main/assets/www/');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  console.log('Web build: dist/');
}
