import { copyFile, mkdir, rm } from 'node:fs/promises';

const assets = [
  'index.html', 'history.html', 'app.js', 'history.js',
  'minimax-h3-long.js', 'minimax-h3-v2-config.js', 'minimax-h3-v2-runtime.js',
  'qwen-editorial-config.js', 'qwen-editorial-runtime.js', 'style.css', 'history.css', 'graphite-console.css'
];

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await Promise.all(assets.map(file => copyFile(file, `dist/${file}`)));
