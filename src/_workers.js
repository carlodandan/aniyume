// --- App Logic ---
const TADB_API_BASE = 'https://aniyume-api.vercel.app';

// Helper function to create a response with CORS headers
const createCorsResponse = (body, options = {}) => {
    const responseOptions = {
        ...options,
        headers: {
            ...options.headers,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': '*',
        },
    };
    return new Response(body, responseOptions);
};

// Function to handle fetching from the target URL
const fetchTarget = (urlString) => {
    const url = new URL(urlString);
    return fetch(url.toString(), {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117 Safari/537.36',
            'Referer': url.origin,
        },
    });
};

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // --- CORS Preflight for any route ---
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': '*',
                },
            });
        }

        // --- Comments API: POST /comments ---
        if (url.pathname === '/comments' && request.method === 'POST') {
            try {
                const { username, comment, episode_id } = await request.json();
                if (!username || !comment || !episode_id) {
                    return createCorsResponse(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
                }

                const stmt = env.DB.prepare(
                    'INSERT INTO comments (username, comment, episode_id) VALUES (?, ?, ?)'
                );
                await stmt.bind(username, comment, episode_id).run();

                return createCorsResponse(JSON.stringify({ success: true }), { status: 200 });
            } catch (err) {
                console.error('DB Insert Error:', err);
                return createCorsResponse(JSON.stringify({ error: 'Failed to save comment' }), { status: 500 });
            }
        }

        // --- Comments API: GET /comments ---
        if (url.pathname === '/comments' && request.method === 'GET') {
            try {
                const episodeId = url.searchParams.get('episode_id');
                if (!episodeId) {
                    return createCorsResponse(JSON.stringify({ success: false, message: 'Missing episode_id' }), { status: 400 });
                }

                const result = await env.DB.prepare(
                    'SELECT id, username, comment, timestamp FROM comments WHERE episode_id = ? ORDER BY timestamp DESC LIMIT 50'
                ).bind(episodeId).all();

                return createCorsResponse(JSON.stringify({ success: true, comments: result.results }), { status: 200 });
            } catch (err) {
                return createCorsResponse(JSON.stringify({ success: false, message: 'Failed to fetch comments', details: err.message }), { status: 500 });
            }
        }

        // --- M3U8 Playlist Proxy ---
        if (url.pathname === '/m3u8-proxy') {
            const targetUrlString = url.searchParams.get('url');
            if (!targetUrlString) return createCorsResponse(JSON.stringify({ error: 'Missing ?url parameter' }), { status: 400 });

            try {
                const response = await fetchTarget(targetUrlString);
                let manifestText = await response.text();
                const baseUrl = new URL('.', targetUrlString).toString();

                const rewrittenManifest = manifestText.split('\n').map(line => {
                    const trimmedLine = line.trim();
                    if (trimmedLine && !trimmedLine.startsWith('#')) {
                        const absoluteUrl = new URL(trimmedLine, baseUrl).toString();
                        return `${url.origin}/ts-proxy?url=${encodeURIComponent(absoluteUrl)}`;
                    }
                    if (trimmedLine.startsWith('#EXT-X-KEY')) {
                        const uriMatch = trimmedLine.match(/URI="([^"]+)"/);
                        if (uriMatch && uriMatch[1]) {
                            const keyUrl = new URL(uriMatch[1], baseUrl).toString();
                            const proxiedKeyUrl = `${url.origin}/ts-proxy?url=${encodeURIComponent(keyUrl)}`;
                            return trimmedLine.replace(uriMatch[1], proxiedKeyUrl);
                        }
                    }
                    return line;
                }).join('\n');

                const headers = new Headers(response.headers);
                headers.set('Content-Type', 'application/vnd.apple.mpegurl');
                return createCorsResponse(rewrittenManifest, { status: response.status, headers });
            } catch (err) {
                return createCorsResponse(JSON.stringify({ error: 'Failed to fetch manifest', details: err.message }), { status: 500 });
            }
        }

        // --- TS Segment and Key Proxy ---
        if (url.pathname === '/ts-proxy') {
            const targetUrlString = url.searchParams.get('url');
            if (!targetUrlString) return createCorsResponse(JSON.stringify({ error: 'Missing ?url parameter' }), { status: 400 });

            try {
                const response = await fetchTarget(targetUrlString);
                const headers = new Headers(response.headers);
                if (targetUrlString.endsWith('.ts')) headers.set('Content-Type', 'video/mp2t');
                return createCorsResponse(response.body, { status: response.status, headers });
            } catch (err) {
                return createCorsResponse(JSON.stringify({ error: 'Failed to fetch segment/key', details: err.message }), { status: 500 });
            }
        }

        // --- Proxy API Calls (/api/*) ---
        if (url.pathname.startsWith('/api/')) {
            const targetUrl = TADB_API_BASE + url.pathname + url.search;
            try {
                const response = await fetch(targetUrl, { headers: { 'User-Agent': 'AniYume (via Cloudflare Worker)' } });
                const data = await response.json();
                const headers = new Headers(response.headers);
                headers.set('Content-Type', 'application/json');
                return createCorsResponse(JSON.stringify(data), { status: response.status, headers });
            } catch (err) {
                return createCorsResponse(JSON.stringify({ error: 'Proxy failed', details: err.message }), { status: 500 });
            }
        }

        // --- Static Asset & SPA Fallback ---
        const assetPathRegex = /\.[^/]+$/;
        if (url.pathname !== '/' && assetPathRegex.test(url.pathname)) {
            return env.ASSETS.fetch(request);
        }
        return env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
    },
};
