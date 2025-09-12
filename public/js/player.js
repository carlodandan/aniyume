import { fetchEpisodes, fetchServersForEpisode, fetchStreamData, PROXY_URL } from './api.js';

let player = null;
let currentAnimeId = null;
let currentEpisodeId = null;

/**
 * Manages the Artplayer instance.
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
 * Changes the currently playing episode.
 * @param {string} newEpisodeId - The full ID of the new episode to play.
 */
function changeEpisode(newEpisodeId) {
    if (currentEpisodeId === newEpisodeId) return;

    currentEpisodeId = newEpisodeId;
    const url = new URL(window.location);
    url.searchParams.set('ep', newEpisodeId);
    history.pushState({ episodeId: newEpisodeId }, '', url.toString());

    playerManager.destroy();
    loadPlayerForEpisode(newEpisodeId);
}

/**
 * Changes the streaming server.
 * @param {string} serverName - The name of the server.
 * @param {string} type - The type of stream ('sub' or 'dub').
 */
function changeServer(serverName, type) {
    playerManager.destroy();
    loadPlayerForEpisode(currentEpisodeId, { serverName, type });
}

/**
 * Populates the episode dropdown menu.
 * @param {Array} episodes - The list of episodes for the anime.
 */
/**
 * Populates the episode dropdown menu.
 * @param {Array} episodes - The list of episodes for the anime.
 */
function renderEpisodeDropdown(episodes) {
    const episodeSelect = document.getElementById('episode-select');
    if (!episodeSelect) return;

    // Use the array index + 1 for the episode number, as the object itself lacks it.
    episodeSelect.innerHTML = episodes.map((ep, index) => `
        <option value="${ep.id}" ${ep.id === currentEpisodeId ? 'selected' : ''}>
            Episode ${index + 1}
        </option>
    `).join('');
}

/**
 * Populates the server dropdown menu.
 * @param {Array} servers - The list of available servers.
 * @param {Object} activeServer - The currently active server.
 */
function renderServerDropdown(servers, activeServer) {
    const serverSelect = document.getElementById('server-select');
    if (!serverSelect) return;

    serverSelect.innerHTML = servers.map(server => `
        <option 
            value="${server.serverName}_${server.type}" 
            ${server.serverName === activeServer.serverName && server.type === activeServer.type ? 'selected' : ''}>
            ${server.serverName} (${server.type})
        </option>
    `).join('');
}

/**
 * Adds event listeners to the dropdowns.
 */
function setupEventListeners() {
    const episodeSelect = document.getElementById('episode-select');
    const serverSelect = document.getElementById('server-select');

    if (episodeSelect) {
        episodeSelect.onchange = (event) => changeEpisode(event.target.value);
    }
    if (serverSelect) {
        serverSelect.onchange = (event) => {
            const [serverName, type] = event.target.value.split('_');
            changeServer(serverName, type);
        };
    }
}

/**
 * Adds the quality selector setting to ArtPlayer.
 */
function addQualitySetting(newPlayer, hls) {
    // ... (This function remains unchanged from the previous version)
    if (!hls || !hls.levels || hls.levels.length <= 1) return;
    const qualities = hls.levels.map((level, i) => ({
        html: `${level.height}p`, value: i, default: i === hls.currentLevel,
    }));
    qualities.unshift({ html: "Auto", value: -1, default: hls.autoLevelEnabled });
    newPlayer.setting.add({
        name: "quality", html: "Quality", tooltip: "Auto", selector: qualities,
        onSelect: (item) => { hls.currentLevel = item.value; return item.html; },
    });
}

/**
 * Initializes the ArtPlayer instance for a specific episode.
 */
async function loadPlayerForEpisode(fullEpisodeId, preferredServerDetails = null) {
    const playerContainer = document.getElementById('player');
    playerContainer.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;
    
    try {
        const servers = await fetchServersForEpisode(fullEpisodeId);
        if (!servers || servers.length === 0) throw new Error("No streaming servers found.");

        let chosenServer = preferredServerDetails
            ? servers.find(s => s.serverName === preferredServerDetails.serverName && s.type === preferredServerDetails.type)
            : null;

        if (!chosenServer) {
            chosenServer = servers.find(s => s.serverName === 'HD-2' && s.type === 'sub') || servers.find(s => s.type === 'sub') || servers[0];
        }

        if (!chosenServer) throw new Error("Could not find a suitable server.");

        renderServerDropdown(servers, chosenServer);

        const streamData = await fetchStreamData(fullEpisodeId, chosenServer.serverName, chosenServer.type);
        const sourceUrl = streamData.streamingLink.link.file;
        const subtitles = streamData.streamingLink.tracks || [];
        const headers = { Referer: new URL(sourceUrl).origin + "/" };
        const finalProxyUrl = `${PROXY_URL}m3u8-proxy?url=${encodeURIComponent(sourceUrl)}&headers=${encodeURIComponent(JSON.stringify(headers))}`;

        const newPlayer = new Artplayer({
            url: finalProxyUrl,
            container: playerContainer,
            type: 'm3u8',
            autoplay: true,
            pip: true, setting: true, fullscreen: true, playbackRate: true, fastForward: true, mutex: true,
            theme: '#8b5cf6',
            moreVideoAttr: { crossOrigin: 'anonymous', preload: 'none', playsInline: true },
            customType: {
                m3u8: (video, url, art) => {
                    if (Hls.isSupported()) {
                        if (art.hls) art.hls.destroy();
                        const hls = new Hls();
                        hls.loadSource(url);
                        hls.attachMedia(video);
                        art.hls = hls;
                        art.on("destroy", () => hls.destroy());
                        hls.on(Hls.Events.MANIFEST_PARSED, () => addQualitySetting(art, hls));
                    } else {
                        video.src = url;
                    }
                }
            },
        });
        playerManager.set(newPlayer);

        if (subtitles.length > 0) {
            // ... (subtitle logic remains unchanged)
            const defaultSub = subtitles.find(s => s.label.toLowerCase().includes('english')) || subtitles[0];
            newPlayer.setting.add({
                name: 'subtitles', html: 'Subtitles', tooltip: defaultSub ? defaultSub.label : 'Off',
                selector: [
                    { html: 'Display', switch: true, onSwitch: (item) => { item.tooltip = item.switch ? 'Hide' : 'Show'; newPlayer.subtitle.show = !item.switch; return !item.switch; }},
                    ...subtitles.map(sub => ({ html: sub.label, url: sub.file, default: sub.file === defaultSub.file }))
                ],
                onSelect: (item) => {
                    newPlayer.subtitle.switch(item.url, { name: item.html });
                    return item.html;
                }
            });
            if (defaultSub) newPlayer.subtitle.switch(defaultSub.file, { name: defaultSub.label });
        }
    } catch (err) {
        console.error("Failed to initialize player:", err);
        playerContainer.innerHTML = `<div class="error-message">${err.message}</div>`;
    }
}

/**
 * Initializes the watch page.
 */
export async function initPlayer() {
    playerManager.destroy();

    const urlParams = new URLSearchParams(window.location.search);
    currentEpisodeId = urlParams.get('ep');

    if (!currentEpisodeId) {
        const container = document.querySelector('.player-container');
        if (container) container.innerHTML = `<div class="error-message">No episode ID provided.</div>`;
        return;
    }
    
    currentAnimeId = currentEpisodeId.split('?')[0];

    try {
        // Fetch the episode data object { totalEpisodes, episodes }
        const episodeData = await fetchEpisodes(currentAnimeId);
        
        // Pass the nested 'episodes' array to the render function
        renderEpisodeDropdown(episodeData.episodes || []);
        setupEventListeners();
        await loadPlayerForEpisode(currentEpisodeId);
    } catch (err) {
        console.error("Failed to set up player page:", err);
    }
}