import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

process.env.DEMO_BASE = process.env.DEMO_BASE || '/';

const viteBin = resolve('node_modules', 'vite', 'bin', 'vite.js');
const result = spawnSync(process.execPath, [viteBin, 'build', '--config', 'vite.config.demo.ts'], {
    env: process.env,
    stdio: 'inherit',
});

if (result.status !== 0) {
    process.exit(result.status ?? 1);
}

const domain = (process.env.GITHUB_PAGES_DOMAIN || process.env.WOWO_FOOD_DOMAIN || '').trim();
const outDir = resolve('demo-dist');

if (domain) {
    if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true });
    }
    writeFileSync(resolve(outDir, 'CNAME'), `${domain}\n`, 'utf8');
    console.log(`Wrote demo-dist/CNAME for ${domain}`);
} else {
    console.log('Skipped CNAME: set GITHUB_PAGES_DOMAIN=food.your-domain.com before building.');
}

const entryHtml = resolve(outDir, 'index.html');
if (existsSync(entryHtml)) {
    copyFileSync(entryHtml, resolve(outDir, '404.html'));
    for (const entryName of ['start', 'scan', 'wowo']) {
        const entryDir = resolve(outDir, entryName);
        mkdirSync(entryDir, { recursive: true });
        copyFileSync(entryHtml, resolve(entryDir, 'index.html'));
    }
    console.log('Wrote stable GitHub Pages entries: /start/, /scan/, /wowo/, and 404.html');
}

const assetsDir = resolve('demo-dist', 'assets');
const legacyMainJsNames = [
    'index-BqrTyF3h.js',
    'index-BWINbzzM.js',
    'index-CDt_9n2Y.js',
    'index-DT6oJPQz.js',
    'index-LjP_z9iV.js',
];
const legacyMainCssNames = ['index-CWamBXyO.css', 'index-BrSUvVym.css', 'index-qP9ekr68.css', 'index-jgZ7VLEC.css'];

if (existsSync(assetsDir)) {
    const html = readFileSync(resolve('demo-dist', 'index.html'), 'utf8');
    const currentMainJs = html.match(/assets\/(index-[^"']+\.js)/)?.[1];
    const currentMainCss = html.match(/assets\/(index-[^"']+\.css)/)?.[1];

    if (currentMainJs) {
        for (const legacyName of legacyMainJsNames) {
            copyFileSync(resolve(assetsDir, currentMainJs), resolve(assetsDir, legacyName));
        }
        console.log(`Wrote legacy main JS aliases from ${currentMainJs}`);
    }

    if (currentMainCss) {
        for (const legacyName of legacyMainCssNames) {
            copyFileSync(resolve(assetsDir, currentMainCss), resolve(assetsDir, legacyName));
        }
        console.log(`Wrote legacy main CSS aliases from ${currentMainCss}`);
    }
}
