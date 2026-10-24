import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';

const PORT = process.env.PORT || 3000;
const build = () => spawnSync('node', ['build.js'], { stdio: 'inherit' });

build();
spawn('npx', ['tailwindcss', '-i', 'src/styles.css', '-o', 'dist/styles.css', '--watch'], { stdio: 'inherit' });

let timer;
for (const target of ['posts', 'public', 'templates.js', 'build.js', 'site.config.json']) {
  fs.watch(target, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(build, 100);
  });
}

const types = { '.html': 'text/html', '.css': 'text/css', '.xml': 'application/xml', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.txt': 'text/plain' };

http.createServer((req, res) => {
  let file = path.join('dist', decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith('dist')) return res.writeHead(403).end();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  const found = fs.existsSync(file);
  if (!found) file = 'dist/404.html';
  res.writeHead(found ? 200 : 404, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
