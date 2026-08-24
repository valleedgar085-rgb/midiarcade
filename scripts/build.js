import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, transform } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const wwwDir = path.join(projectRoot, 'www');

if (fs.existsSync(wwwDir)) {
  fs.rmSync(wwwDir, { recursive: true, force: true });
}
fs.mkdirSync(wwwDir, { recursive: true });
fs.writeFileSync(path.join(wwwDir, '.nojekyll'), '');

function copyRecursiveSync(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursiveSync(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('Building web assets into www/...');
copyRecursiveSync(path.join(projectRoot, 'index.html'), path.join(wwwDir, 'index.html'));
copyRecursiveSync(path.join(projectRoot, 'privacy-policy.html'), path.join(wwwDir, 'privacy-policy.html'));
copyRecursiveSync(path.join(projectRoot, 'manifest.webmanifest'), path.join(wwwDir, 'manifest.webmanifest'));
copyRecursiveSync(path.join(projectRoot, 'assets'), path.join(wwwDir, 'assets'));

const stylesheet = await transform(
  fs.readFileSync(path.join(projectRoot, 'styles.css'), 'utf8'),
  {
    loader: 'css',
    minify: true,
    target: ['chrome120'],
    legalComments: 'none',
  },
);
fs.writeFileSync(path.join(wwwDir, 'styles.css'), stylesheet.code);

await build({
  entryPoints: [
    path.join(projectRoot, 'src', 'app.js'),
    path.join(projectRoot, 'src', 'generation-worker.js'),
  ],
  outdir: path.join(wwwDir, 'src'),
  bundle: true,
  splitting: true,
  entryNames: '[name]',
  chunkNames: 'chunks/[name]-[hash]',
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'warning',
});

const androidPublicDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'assets', 'public');
if (fs.existsSync(androidPublicDir)) {
  copyRecursiveSync(path.join(wwwDir, 'index.html'), path.join(androidPublicDir, 'index.html'));
  copyRecursiveSync(path.join(wwwDir, 'privacy-policy.html'), path.join(androidPublicDir, 'privacy-policy.html'));
  copyRecursiveSync(path.join(wwwDir, 'styles.css'), path.join(androidPublicDir, 'styles.css'));
  copyRecursiveSync(path.join(wwwDir, 'manifest.webmanifest'), path.join(androidPublicDir, 'manifest.webmanifest'));
  copyRecursiveSync(path.join(wwwDir, 'assets'), path.join(androidPublicDir, 'assets'));
  copyRecursiveSync(path.join(wwwDir, 'src'), path.join(androidPublicDir, 'src'));
  console.log('Synced build assets to android/app/src/main/assets/public.');
}

console.log('Web asset build complete.');
