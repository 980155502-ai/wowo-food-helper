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
const appTargetHref = '/app/?wowo_enter=1#/wowo-food';

const createStaticEntryHtml = () => `<!doctype html>
<html lang="zh-CN">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta http-equiv="Pragma" content="no-cache" />
        <meta http-equiv="Expires" content="0" />
        <meta name="application-name" content="窝窝饮食好店指南" />
        <meta name="apple-mobile-web-app-title" content="窝窝饮食好店指南" />
        <meta name="description" content="窝窝青年旅舍附近 47 家核准餐馆筛选、留言、投票和高德定位指南。" />
        <meta property="og:title" content="窝窝饮食好店指南" />
        <meta property="og:description" content="从窝窝出发，按骑行距离、饭点和心情筛选附近好店。" />
        <link rel="preload" as="image" href="/assets/nanchang-flat-start-mobile-DO-pWQP7.jpg" />
        <title>窝窝饮食好店指南</title>
        <style>
            html,
            body {
                min-height: 100%;
            }

            body {
                margin: 0;
                background: #fbf4e8;
                color: #4b3926;
                font-family:
                    -apple-system,
                    BlinkMacSystemFont,
                    'PingFang SC',
                    'Microsoft YaHei',
                    sans-serif;
            }

            .wowo-static-intro {
                display: block;
                min-height: 100vh;
                padding: 18px 14px;
                box-sizing: border-box;
                background: linear-gradient(180deg, rgba(255, 250, 239, 0.9), rgba(246, 232, 202, 0.9)), #f8edcf;
                text-align: center;
            }

            .wowo-static-stage {
                position: relative;
                display: inline-block;
                width: 362px;
                max-width: calc(100vw - 28px);
                height: 746px;
                height: calc(100vh - 36px);
                max-height: 746px;
                min-height: 560px;
                overflow: hidden;
                border-radius: 28px;
                background: #efc55b url('/assets/nanchang-flat-start-mobile-DO-pWQP7.jpg') center / contain no-repeat;
                box-shadow:
                    0 24px 54px rgba(116, 84, 34, 0.18),
                    0 0 0 1px rgba(112, 78, 34, 0.1);
                vertical-align: top;
            }

            .wowo-static-stage img {
                display: block;
                width: 100%;
                height: 100%;
                object-fit: contain;
                object-position: center;
            }

            .wowo-static-title {
                position: absolute;
                left: 24px;
                right: 24px;
                bottom: 104px;
                display: block;
                padding: 16px 14px 17px;
                border-radius: 22px;
                background: rgba(255, 249, 231, 0.9);
                color: #4b3926;
                text-align: center;
                box-shadow: 0 12px 28px rgba(112, 78, 34, 0.12);
            }

            .wowo-static-title span {
                display: block;
                margin-bottom: 7px;
                color: #7a6141;
                font-size: 13px;
                line-height: 1.2;
                font-weight: 900;
            }

            .wowo-static-title strong {
                display: block;
                font-size: 28px;
                line-height: 1.05;
                font-weight: 900;
            }

            .wowo-static-action {
                position: absolute;
                left: 50%;
                bottom: 34px;
                width: 230px;
                max-width: calc(100% - 58px);
                min-height: 48px;
                transform: translateX(-50%);
                border: 0;
                border-radius: 24px;
                background: #fffaf1;
                color: #7a4b2c;
                box-sizing: border-box;
                display: block;
                padding: 16px 18px;
                text-align: center;
                text-decoration: none;
                font-size: 16px;
                line-height: 1;
                font-weight: 900;
            }
        </style>
    </head>

    <body>
        <main class="wowo-static-intro" data-wowo-static-only>
            <section class="wowo-static-stage" aria-label="窝窝吃饭小助手">
                <img
                    src="/assets/nanchang-flat-start-mobile-DO-pWQP7.jpg"
                    width="941"
                    height="1672"
                    alt=""
                    decoding="sync"
                />
                <div class="wowo-static-title">
                    <span>窝窝吃饭小助手</span>
                    <strong>今天吃什么？</strong>
                </div>
                <a class="wowo-static-action" href="${appTargetHref}">开始找吃的</a>
            </section>
        </main>
    </body>
</html>
`;

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
let appHtml = '';
if (existsSync(entryHtml)) {
    appHtml = readFileSync(entryHtml, 'utf8');

    for (const entryName of ['app', 'wowo']) {
        const entryDir = resolve(outDir, entryName);
        mkdirSync(entryDir, { recursive: true });
        writeFileSync(resolve(entryDir, 'index.html'), appHtml, 'utf8');
    }

    const staticHtml = createStaticEntryHtml();
    writeFileSync(entryHtml, staticHtml, 'utf8');
    writeFileSync(resolve(outDir, '404.html'), appHtml, 'utf8');
    for (const entryName of ['start', 'scan']) {
        const entryDir = resolve(outDir, entryName);
        mkdirSync(entryDir, { recursive: true });
        writeFileSync(resolve(entryDir, 'index.html'), staticHtml, 'utf8');
    }
    console.log('Wrote pure static scan entries: /, /start/, /scan/. App entry: /app/.');
}

const assetsDir = resolve('demo-dist', 'assets');
const legacyMainJsNames = [
    'index-BqrTyF3h.js',
    'index-BWINbzzM.js',
    'index-CDt_9n2Y.js',
    'index-DT6oJPQz.js',
    'index-LjP_z9iV.js',
    'index-Cbu5CT80.js',
    'index-CeptVpSx.js',
    'index-BhoLqGWp.js',
    'index-CSFkFpG1.js',
    'index-DDOtbZMd.js',
    'index-CRLbh-BP.js',
];
const legacyMainCssNames = ['index-CWamBXyO.css', 'index-BrSUvVym.css', 'index-qP9ekr68.css', 'index-jgZ7VLEC.css'];
legacyMainCssNames.push('index-BnGQEXrA.css');

if (existsSync(assetsDir)) {
    const htmlForAssets = appHtml || readFileSync(resolve('demo-dist', 'index.html'), 'utf8');
    const currentMainJs = htmlForAssets.match(/assets\/(index-[^"']+\.js)/)?.[1];
    const currentMainCss = htmlForAssets.match(/assets\/(index-[^"']+\.css)/)?.[1];

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
