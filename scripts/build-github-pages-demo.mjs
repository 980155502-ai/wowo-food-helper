import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
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

if (domain) {
    const outDir = resolve('demo-dist');
    if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true });
    }
    writeFileSync(resolve(outDir, 'CNAME'), `${domain}\n`, 'utf8');
    console.log(`Wrote demo-dist/CNAME for ${domain}`);
} else {
    console.log('Skipped CNAME: set GITHUB_PAGES_DOMAIN=food.your-domain.com before building.');
}
