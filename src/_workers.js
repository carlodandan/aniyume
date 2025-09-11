// --- App Logic ---
const TADB_API_BASE = 'https://theanimedb-api.vercel.app';

// Helper function to create a response with CORS headers
const createCorsResponse = (body, options) => {
    const responseOptions = {
        ...options,
        headers: {
            ...options.headers,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

        // --- CORS Preflight ---
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': '*',
                },
            });
        }

        // --- M3U8 Playlist Proxy ---
        if (url.pathname === '/m3u8-proxy') {
            const targetUrlString = url.searchParams.get('url');
            if (!targetUrlString) {
                return createCorsResponse(JSON.stringify({ error: 'Missing ?url parameter' }), { status: 400 });
            }

            try {
                const response = await fetchTarget(targetUrlString);
                let manifestText = await response.text();
                const baseUrl = new URL('.', targetUrlString).toString();

                // Rewrite segment and key URLs to go through the /ts-proxy
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
            if (!targetUrlString) {
                return createCorsResponse(JSON.stringify({ error: 'Missing ?url parameter' }), { status: 400 });
            }

            try {
                const response = await fetchTarget(targetUrlString);
                const headers = new Headers(response.headers);
                
                // Set appropriate Content-Type for video segments
                if (targetUrlString.endsWith('.ts')) {
                    headers.set('Content-Type', 'video/mp2t');
                }
                
                return createCorsResponse(response.body, { status: response.status, headers: headers });

            } catch (err) {
                return createCorsResponse(JSON.stringify({ error: 'Failed to fetch segment/key', details: err.message }), { status: 500 });
            }
        }

        // --- Proxy API Calls (/api/*) ---
        if (url.pathname.startsWith('/api/')) {
            const targetUrl = TADB_API_BASE + url.pathname + url.search;
            try {
                const response = await fetch(targetUrl, {
                    headers: { 'User-Agent': 'TheAnimeDB (via Cloudflare Worker)' },
                });

                const data = await response.json();
                const headers = new Headers(response.headers);
                headers.set('Content-Type', 'application/json');
                
                return createCorsResponse(JSON.stringify(data), {
                    status: response.status,
                    headers: headers
                });
            } catch (err) {
                return createCorsResponse(JSON.stringify({ error: 'Proxy failed', details: err.message }), {
                    status: 500
                });
            }
        }

        // --- Static Asset & SPA Fallback ---
        // Check if the path looks like a file with an extension.
        const assetPathRegex = /\.[^/]+$/;
        if (url.pathname !== '/' && assetPathRegex.test(url.pathname)) {
            // It's likely a static asset. Let ASSETS handle it.
            // This will correctly return a 404 if the asset doesn't exist.
            return env.ASSETS.fetch(request);
        }

        // It's not an asset, so it must be an SPA route. Serve the main app.
        return env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
    },
};