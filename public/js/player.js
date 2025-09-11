import { fetchEpisodes, fetchServersForEpisode, fetchStreamData, PROXY_URL } from './api.js';

let player = null;

/**
 * Manages the Artplayer instance to prevent conflicts and ensure proper cleanup.
 */
export const playerManager = {
    get: () => player,
    set: (newInstance) => { player = newInstance; },
    destroy: () => {
        if (player) {
            player.destroy();
            player = null;
        }
    }
};

/**
 * Helper function to dynamically add a quality selector to ArtPlayer's settings.
 * @param {Artplayer} newPlayer - The Artplayer instance.
 * @param {Hls} hls - The Hls.js instance.
 */
function addQualitySetting(newPlayer, hls) {
    if (!hls || !hls.levels || hls.levels.length <= 1) {
        return; // No multiple quality levels available
    }

    const qualities = hls.levels.map((level, i) => ({
        html: `${level.height}p`,
        value: i,
        default: i === hls.currentLevel,
    }));

    qualities.unshift({ html: "Auto", value: -1, default: hls.autoLevelEnabled });

    newPlayer.setting.add({
        name: "quality",
        html: "Quality",
        tooltip: "Auto",
        selector: qualities,
        onSelect: (item) => {
            hls.currentLevel = item.value; // -1 enables auto-switching
            return item.html;
        },
    });
}

/**
 * Initializes the Artplayer instance by fetching episodes, servers, and stream data.
 */
export async function initPlayer() {
    playerManager.destroy(); // Always destroy the old instance before creating a new one

    const playerContainer = document.getElementById('player');
    playerContainer.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
        </div>`;

    const animeId = localStorage.getItem('selectedAnimeId');
    if (!animeId) {
        playerContainer.innerHTML = `<div class="error-message">No anime ID was provided.</div>`;
        return;
    }

    try {
        // Step 1: Fetch all episodes for the anime
        const episodes = await fetchEpisodes(animeId);
        if (!episodes || episodes.length === 0) {
            throw new Error("No episodes found for this anime.");
        }

        const firstEpisode = episodes[0];
        const fullEpisodeId = firstEpisode.id;

        // Step 2: Fetch servers for the selected episode
        const servers = await fetchServersForEpisode(fullEpisodeId);
        if (!servers || servers.length === 0) {
            throw new Error("No streaming servers were found for this episode.");
        }
        
        const preferredServer = servers.find(s => s.serverName === 'HD-2' && s.type === 'sub') || servers.find(s => s.type === 'sub') || servers[0];
        
        if (!preferredServer) {
            throw new Error("Could not find a suitable streaming server.");
        }

        // Step 3: Fetch the stream data from the chosen server
        const streamData = await fetchStreamData(fullEpisodeId, preferredServer.serverName, preferredServer.type);

        const sourceUrl = streamData.streamingLink.link.file;
        const subtitles = streamData.streamingLink.tracks || [];

        const headers = {};
            if (sourceUrl) {
                const url = new URL(sourceUrl);
                headers.Referer = url.origin + "/";
            } else {
                headers.Referer = "https://megacloud.club/";
            }

            const proxyUrl = `${PROXY_URL}m3u8-proxy?url=`;

            const finalProxyUrl = proxyUrl + encodeURIComponent(sourceUrl) +
                                "&headers=" + encodeURIComponent(JSON.stringify(headers));

        const newPlayer = new Artplayer({
            url: finalProxyUrl,
            container: playerContainer,
            type: 'm3u8',
            autoplay: true,
            pip: true,
            setting: true,
            fullscreen: true,
            playbackRate: true,
            fastForward: true,
            mutex: true,
            theme: '#8b5cf6',
            moreVideoAttr: {
                    crossOrigin: 'anonymous',
                    preload: 'none',
                    playsInline: true,
                },
            customType: {
                m3u8: (video, url, player) => {
                    if (Hls.isSupported()) {
                        if (player.hls) player.hls.destroy();
                        const hls = new Hls();
                        hls.loadSource(url);
                        hls.attachMedia(video);
                        player.hls = hls;

                        player.on("destroy", () => hls.destroy());

                        hls.on(Hls.Events.MANIFEST_PARSED, () => {
                            addQualitySetting(player, hls);
                        });
                    } else {
                        video.src = url;
                    }
                }
            },
        });
        
        playerManager.set(newPlayer); // Register the new instance with the manager

        if (subtitles.length > 0) {
            const defaultSub = subtitles.find(s => s.label.toLowerCase().includes('english')) || subtitles[0];
            newPlayer.setting.add({
                name: 'subtitles',
                html: 'Subtitles',
                tooltip: defaultSub ? defaultSub.label : 'Off',
                selector: [
                    { html: 'Display', switch: true, onSwitch: (item) => { item.tooltip = item.switch ? 'Hide' : 'Show'; newPlayer.subtitle.show = !item.switch; return !item.switch; }},
                    ...subtitles.map(sub => ({
                        html: sub.label,
                        url: sub.file,
                        default: sub.file === defaultSub.file
                    }))
                ],
                onSelect: (item) => {
                    newPlayer.subtitle.switch(item.url, { name: item.html });
                    return item.html;
                }
            });
            if (defaultSub) {
                 newPlayer.subtitle.switch(defaultSub.file, { name: defaultSub.label });
            }
        }

    } catch (err) {
        console.error("Failed to initialize player:", err);
        playerContainer.innerHTML = `<div class="error-message">${err.message}</div>`;
    }
}