import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, cpSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const srcDir = join(projectRoot, 'src');
const distDir = join(projectRoot, 'dist');

// コマンドライン引数からwatchモードを判定
const isWatch = process.argv.includes('--watch');

// distディレクトリを作成
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

// エントリーポイントの設定
const entries = [
  { in: 'contentScript.ts', out: 'contentScript.js' },
  { in: 'popup.ts', out: 'popup.js' },
  { in: 'background.ts', out: 'background.js' },
  { in: 'options.ts', out: 'options.js' },
];

// 共通のesbuild設定
const commonConfig = {
  bundle: true,
  format: 'iife',
  target: 'es2020',
  sourcemap: true,
  minify: false,
  logLevel: 'info',
};

// アセットファイルをコピー
function copyAssets() {
  const assets = ['popup.html', 'popup.css', 'options.html'];
  assets.forEach(asset => {
    const srcPath = join(srcDir, asset);
    const destPath = join(distDir, asset);
    if (existsSync(srcPath)) {
      copyFileSync(srcPath, destPath);
      console.log(`Copied: ${asset}`);
    }
  });

  // iconディレクトリをコピー
  const iconSrcDir = join(projectRoot, 'icon');
  const iconDestDir = join(distDir, 'icon');
  if (existsSync(iconSrcDir)) {
    cpSync(iconSrcDir, iconDestDir, { recursive: true });
    console.log('Copied: icon directory');
  }

  // manifest.jsonをdistにコピー（パスを修正）
  const manifestSrc = join(projectRoot, 'manifest.json');
  const manifestDest = join(distDir, 'manifest.json');
  if (existsSync(manifestSrc)) {
    const manifestContent = JSON.parse(readFileSync(manifestSrc, 'utf-8'));

    // dist/プレフィックスを削除
    if (manifestContent.background?.service_worker) {
      manifestContent.background.service_worker = manifestContent.background.service_worker.replace(/^dist\//, '');
    }
    if (manifestContent.content_scripts) {
      manifestContent.content_scripts = manifestContent.content_scripts.map(cs => ({
        ...cs,
        js: cs.js.map(script => script.replace(/^dist\//, '')).filter(s => s !== 'storageManager.js')
      }));
    }
    if (manifestContent.web_accessible_resources) {
      manifestContent.web_accessible_resources = manifestContent.web_accessible_resources.map(war => ({
        ...war,
        resources: war.resources.map(r => r.replace(/^dist\//, ''))
      }));
    }
    if (manifestContent.action?.default_popup) {
      manifestContent.action.default_popup = manifestContent.action.default_popup.replace(/^dist\//, '');
    }

    writeFileSync(manifestDest, JSON.stringify(manifestContent, null, 2));
    console.log('Copied and processed: manifest.json');
  }
}

async function build() {
  try {
    // すべてのエントリーポイントをビルド
    await Promise.all(entries.map(entry =>
      esbuild.build({
        ...commonConfig,
        entryPoints: [join(srcDir, entry.in)],
        outfile: join(distDir, entry.out),
      })
    ));

    copyAssets();
    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

async function watch() {
  try {
    // すべてのエントリーポイントに対してwatchコンテキストを作成
    const contexts = await Promise.all(entries.map(entry =>
      esbuild.context({
        ...commonConfig,
        entryPoints: [join(srcDir, entry.in)],
        outfile: join(distDir, entry.out),
      })
    ));

    // 各コンテキストでwatchを開始
    await Promise.all(contexts.map(ctx => ctx.watch()));

    copyAssets();
    console.log('Watching for changes...');
  } catch (error) {
    console.error('Watch failed:', error);
    process.exit(1);
  }
}

if (isWatch) {
  watch();
} else {
  build();
}
