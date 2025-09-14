// For Vercel Deployment

const fetch = require('node-fetch');

const TADB_API_BASE = 'https://aniyume-api.vercel.app';

const fetchTarget = (urlString) => {
    const url = new URL(urlString);
    return fetch(url.toString(), {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117 Safari/537.36',
            'Referer': url.origin,
        },
    });
};

module.exports = async (req, res) => {
    // Note: Vercel automatically parses the URL and query parameters.
    const fullUrl = `https://${req.headers.host}${req.url}`;
    const url = new URL(fullUrl);
    const { searchParams } = url;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    if (url.pathname.startsWith('/api/')) {
        const targetUrl = TADB_API_BASE + req.url; // req.url includes the path and query
        try {
            const response = await fetch(targetUrl);
            const data = await response.json();
            res.status(response.status).json(data);
        } catch (err) {
            res.status(500).json({ error: 'Proxy failed', details: err.message });
        }
    } else if (url.pathname === '/m3u8-proxy') {
        const targetUrlString = searchParams.get('url');
        if (!targetUrlString) {
            return res.status(400).json({ error: 'Missing ?url parameter' });
        }
        try {
            const response = await fetchTarget(targetUrlString);
            let manifestText = await response.text();
            const baseUrl = new URL('.', targetUrlString).toString();
            const rewrittenManifest = manifestText.split('\n').map(line => {
                const trimmedLine = line.trim();
                if (trimmedLine && !trimmedLine.startsWith('#')) {
                    const absoluteUrl = new URL(trimmedLine, baseUrl).toString();
                    return `/ts-proxy?url=${encodeURIComponent(absoluteUrl)}`;
                }
                if (trimmedLine.startsWith('#EXT-X-KEY')) {
                    const uriMatch = trimmedLine.match(/URI="([^"]+)"/);
                    if (uriMatch && uriMatch[1]) {
                       const keyUrl = new URL(uriMatch[1], baseUrl).toString();
                       const proxiedKeyUrl = `/ts-proxy?url=${encodeURIComponent(keyUrl)}`;
                       return trimmedLine.replace(uriMatch[1], proxiedKeyUrl);
                    }
                }
                return line;
            }).join('\n');
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.status(response.status).send(rewrittenManifest);
        } catch (err) {
            res.status(500).json({ error: 'Failed to fetch manifest', details: err.message });
        }
    } else if (url.pathname === '/ts-proxy') {
        const targetUrlString = searchParams.get('url');
        if (!targetUrlString) {
            return res.status(400).json({ error: 'Missing ?url parameter' });
        }
        try {
            const response = await fetchTarget(targetUrlString);
            res.setHeader('Content-Type', response.headers.get('Content-Type'));
            response.body.pipe(res);
        } catch (err) {
            res.status(500).json({ error: 'Failed to fetch segment/key', details: err.message });
        }
    } else {
        // Fallback for any other unhandled paths hitting the proxy
        res.status(404).send('Not Found');
    }
};