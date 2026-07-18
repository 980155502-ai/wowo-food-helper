import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const demoDist = resolve(root, 'demo-dist');
const siteDist = resolve(root, 'dist');
const clientDist = resolve(siteDist, 'client');

const copyDir = (source, destination) => {
    mkdirSync(destination, { recursive: true });

    for (const entry of readdirSync(source, { withFileTypes: true })) {
        const sourcePath = resolve(source, entry.name);
        const destinationPath = resolve(destination, entry.name);

        if (entry.isDirectory()) {
            copyDir(sourcePath, destinationPath);
            continue;
        }

        copyFileSync(sourcePath, destinationPath);
    }
};

rmSync(siteDist, { recursive: true, force: true });
copyDir(demoDist, clientDist);
mkdirSync(resolve(siteDist, 'server'), { recursive: true });

writeFileSync(
    resolve(siteDist, 'server', 'index.js'),
    `const withAssetPath = (request, pathname) => {
    const url = new URL(request.url);
    url.pathname = pathname;
    return new Request(url, request);
};

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname === '/animal-island-ui' || url.pathname.startsWith('/animal-island-ui/')) {
            const strippedPath = url.pathname.replace(/^\\/animal-island-ui/, '') || '/';
            const assetResponse = await env.ASSETS.fetch(withAssetPath(request, strippedPath));
            if (assetResponse.status !== 404) return assetResponse;
        }

        const assetResponse = await env.ASSETS.fetch(request);
        if (assetResponse.status !== 404) return assetResponse;

        return env.ASSETS.fetch(withAssetPath(request, '/index.html'));
    },
};
`
);
