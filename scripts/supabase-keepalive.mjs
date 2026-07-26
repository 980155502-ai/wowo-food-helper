const urlFromEnv = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
const isDryRun = process.env.SUPABASE_KEEPALIVE_DRY_RUN === '1';

const endpoints = [
    { name: 'vote_counts', path: '/rest/v1/vote_counts?select=restaurant_id,vote_count&limit=1' },
    { name: 'shop_comments', path: '/rest/v1/shop_comments?select=id,created_at&limit=1' },
    { name: 'free_notes', path: '/rest/v1/free_notes?select=id,created_at&limit=1' },
];

const fail = (message) => {
    console.error(`[supabase-keepalive] ${message}`);
    process.exit(1);
};

if (!urlFromEnv || !anonKey) {
    fail('Missing SUPABASE_URL/SUPABASE_ANON_KEY or VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY.');
}

let supabaseUrl;
try {
    supabaseUrl = new URL(urlFromEnv);
} catch {
    fail(`Invalid Supabase URL: ${urlFromEnv}`);
}

const baseUrl = supabaseUrl.href.replace(/\/$/, '');

console.log(`[supabase-keepalive] Checking ${endpoints.length} public read endpoints on ${supabaseUrl.host}.`);

if (isDryRun) {
    for (const endpoint of endpoints) {
        console.log(`[supabase-keepalive] Dry run: ${endpoint.name} -> ${baseUrl}${endpoint.path}`);
    }
    process.exit(0);
}

const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Accept: 'application/json',
};

for (const endpoint of endpoints) {
    const response = await fetch(`${baseUrl}${endpoint.path}`, { headers });
    const body = await response.text();

    if (!response.ok) {
        fail(`${endpoint.name} returned HTTP ${response.status}: ${body.slice(0, 300)}`);
    }

    console.log(`[supabase-keepalive] ${endpoint.name} ok (${response.status}).`);
}

console.log('[supabase-keepalive] Done.');
