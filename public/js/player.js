import { fetchEpisodes, fetchServersForEpisode, fetchStreamData } from './api.js';

/**
 * Helper function to dynamically add a quality selector to ArtPlayer's settings.
 * @param {Artplayer} player - The Artplayer instance.
 * @param {Hls} hls - The Hls.js instance.
 */
function addQualitySetting(player, hls) {
    if (!hls || !hls.levels || hls.levels.length <= 1) {
        return; // No multiple quality levels available
    }

    const qualities = hls.levels.map((level, i) => ({
        html: `${level.height}p`,
        value: i,
        default: i === hls.currentLevel,
    }));

    qualities.unshift({ html: "Auto", value: -1, default: hls.autoLevelEnabled });

    player.setting.add({
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
    if (window.artplayer) {
        window.artplayer.destroy();
    }

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

        // For now, we'll automatically play the first episode.
        // A UI for episode selection could be added later.
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

        const headers = { Referer: new URL(sourceUrl).origin + "/" };
        const proxyUrl = `/m3u8-proxy?url=${encodeURIComponent(sourceUrl)}&headers=${encodeURIComponent(JSON.stringify(headers))}`;
        
        window.artplayer = new window.Artplayer({
            container: playerContainer,
            url: proxyUrl,
            type: 'm3u8',
            autoplay: true,
            pip: true,
            setting: true,
            fullscreen: true,
            playbackRate: true,
            fastForward: true,
            mutex: true,
            theme: '#8b5cf6',
            customType: {
                m3u8: (video, url, player) => {
                    if (window.Hls.isSupported()) {
                        if (player.hls) player.hls.destroy();
                        const hls = new window.Hls();
                        hls.loadSource(url);
                        hls.attachMedia(video);
                        player.hls = hls;

                        player.on("destroy", () => hls.destroy());

                        hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                            addQualitySetting(player, hls);
                        });
                    } else {
                        video.src = url;
                    }
                }
            },
        });

        if (subtitles.length > 0) {
            const defaultSub = subtitles.find(s => s.label.toLowerCase().includes('english')) || subtitles[0];
            window.artplayer.setting.add({
                name: 'subtitles',
                html: 'Subtitles',
                tooltip: defaultSub ? defaultSub.label : 'Off',
                selector: [
                    { html: 'Display', switch: true, onSwitch: (item) => { item.tooltip = item.switch ? 'Hide' : 'Show'; window.artplayer.subtitle.show = !item.switch; return !item.switch; }},
                    ...subtitles.map(sub => ({
                        html: sub.label,
                        url: sub.file,
                        default: sub.file === defaultSub.file
                    }))
                ],
                onSelect: (item) => {
                    window.artplayer.subtitle.switch(item.url, { name: item.html });
                    return item.html;
                }
            });
            if (defaultSub) {
                 window.artplayer.subtitle.switch(defaultSub.file, { name: defaultSub.label });
            }
        }

    } catch (err) {
        console.error("Failed to initialize player:", err);
        playerContainer.innerHTML = `<div class="error-message">${err.message}</div>`;
    }
}

