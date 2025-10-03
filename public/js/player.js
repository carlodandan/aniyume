import { 
    fetchComments, 
    postComment, 
    fetchEpisodes, 
    fetchServersForEpisode, 
    fetchStreamData, 
    PROXY_URL, 
    fetchAnimeDetails, 
    fetchScheduleData 
} from './api.js';

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

// --- Function to save watch progress ---
function saveWatchProgress(animeDetails, episodeId, currentTime, duration) {
    if (!animeDetails || !animeDetails.id || !episodeId || currentTime < 60 || currentTime > duration - 60) {
        return;
    }

    try {
        let history = JSON.parse(localStorage.getItem('aniyumeWatchHistory')) || {};
        
        history[animeDetails.id] = {
            id: animeDetails.id,
            title: animeDetails.title,
            poster: animeDetails.poster,
            episodeId: episodeId,
            currentTime: currentTime,
            watchedAt: new Date().toISOString()
        };

        // keep only last 12 entries
        const sortedHistory = Object.values(history).sort((a, b) => new Date(b.watchedAt) - new Date(a.watchedAt));
        const limitedHistory = sortedHistory.slice(0, 12).reduce((acc, item) => {
            acc[item.id] = item;
            return acc;
        }, {});

        localStorage.setItem('aniyumeWatchHistory', JSON.stringify(limitedHistory));
    } catch (e) {
        console.error("Failed to save watch history:", e);
    }
}

// --- Debounce helper ---
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

/**
 * Changes the currently playing episode.
 */
async function changeEpisode(newEpisodeId) {
    if (currentEpisodeId === newEpisodeId) return;

    currentEpisodeId = newEpisodeId;
    const url = new URL(window.location);
    url.searchParams.set('ep', newEpisodeId);
    history.pushState({ episodeId: newEpisodeId }, '', url.toString());

    playerManager.destroy();

    await loadPlayerForEpisode(newEpisodeId, window.__animeDetails);
    await loadComments(newEpisodeId);
}

/**
 * Changes the streaming server.
 */
function changeServer(serverName, type) {
    playerManager.destroy();
    loadPlayerForEpisode(currentEpisodeId, window.__animeDetails, { serverName, type });
}

/**
 * Populates the episode dropdown menu.
 */
function renderEpisodeDropdown(episodes) {
    const episodeSelect = document.getElementById('episode-select');
    if (!episodeSelect) return;
    const reversedEpisodes = [...episodes].reverse();
    const totalEpisodes = episodes.length;
    episodeSelect.innerHTML = reversedEpisodes.map((ep, index) => `
        <option value="${ep.id}" ${ep.id === currentEpisodeId ? 'selected' : ''}>
            Episode ${totalEpisodes - index}
        </option>
    `).join('');
}

/**
 * Populates the server dropdown menu.
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
async function loadPlayerForEpisode(fullEpisodeId, animeDetails, preferredServerDetails = null) {
    const playerContainer = document.getElementById('player');
    playerContainer.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;
    
    const urlParams = new URLSearchParams(window.location.search);
    const startTime = parseInt(urlParams.get('t'), 10) || 0;

    try {
        const servers = await fetchServersForEpisode(fullEpisodeId);
        if (!servers || servers.length === 0) throw new Error("No streaming servers found.");

        let chosenServer = preferredServerDetails
            ? servers.find(s => s.serverName === preferredServerDetails.serverName && s.type === preferredServerDetails.type)
            : servers.find(s => s.serverName === 'HD-2' && s.type === 'sub') || servers.find(s => s.type === 'sub') || servers[0];

        if (!chosenServer) throw new Error("Could not find a suitable server.");

        renderServerDropdown(servers, chosenServer);

        const streamData = await fetchStreamData(fullEpisodeId, chosenServer.serverName, chosenServer.type);
        const sourceUrl = streamData.streamingLink.link.file;
        const subtitles = streamData.streamingLink.tracks || [];
        
        const subtitleOptions = {
            html: true,
            style: {
                color: "#FFFFFF",
                "text-shadow": "2px 2px 2px rgba(0, 0, 0, 1)",
                "font-weight": "400",
                left: "50%",
                transform: "translateX(-50%)",
                "margin-bottom": "2rem",
            },
            escape: false,
        };
        
        const headers = { Referer: new URL(sourceUrl).origin + "/" };
        const finalProxyUrl = `${PROXY_URL}m3u8-proxy?url=${encodeURIComponent(sourceUrl)}&headers=${encodeURIComponent(JSON.stringify(headers))}`;
        playerContainer.innerHTML = "";
        
        const newPlayer = new Artplayer({
            url: finalProxyUrl,
            container: playerContainer,
            type: 'm3u8',
            volume: parseFloat(localStorage.getItem('player-volume')) || 0.7,
            autoplay: true,
            playsInline: true,
            pip: true,
            setting: true,
            fullscreen: true,
            autoOrientation: true,
            hideCursor: false,
            playbackRate: true,
            fastForward: true,
            hotkey: true,
            mutex: true,
            theme: '#8b5cf6',
            startTime: startTime,
            subtitle: subtitleOptions, 
            moreVideoAttr: { 
                crossOrigin: 'anonymous',
                preload: 'none',
                playsInline: true 
            },
            customType: {
                m3u8: (video, url, art) => {
                    if (Hls.isSupported()) {
                        if (art.hls) art.hls.destroy();
                        const hls = new Hls();

                        hls.on(Hls.Events.ERROR, (event, data) => {
                            if (data.fatal) {
                                console.error('Fatal HLS Error:', data);
                                art.notice.show = `Error: Could not load video. Please try another server.`;
                            }
                        });

                        hls.loadSource(url);
                        hls.attachMedia(video);
                        art.hls = hls;

                        const debouncedSave = debounce(() => {
                            if (art.video.currentTime && art.video.duration) {
                                saveWatchProgress(animeDetails, fullEpisodeId, art.video.currentTime, art.video.duration);
                            }
                        }, 5000);

                        art.on('timeupdate', debouncedSave);
                        art.on("destroy", () => hls.destroy());
                        hls.on(Hls.Events.MANIFEST_PARSED, () => addQualitySetting(art, hls));

                        // Save immediately before unload
                        window.addEventListener("beforeunload", () => {
                            if (art.video) {
                                saveWatchProgress(animeDetails, fullEpisodeId, art.video.currentTime, art.video.duration);
                            }
                        });
                    } else {
                        video.src = url;
                    }
                }
            },
        });

        playerManager.set(newPlayer);

        newPlayer.on('volumeChange', (volume) => {
            localStorage.setItem('player-volume', volume);
        });

        // Subtitles setup
        if (subtitles.length > 0) {
            const defaultSub = subtitles.find(s => s.label.toLowerCase().includes('english')) || subtitles[0];
            newPlayer.setting.add({
                name: 'subtitles', html: 'Subtitles', tooltip: defaultSub ? defaultSub.label : 'Off',
                selector: [
                    { html: 'Display', switch: true, onSwitch: (item) => { item.tooltip = item.switch ? 'Hide' : 'Show'; newPlayer.subtitle.show = !item.switch; return !item.switch; } },
                    ...subtitles.map(sub => ({ html: sub.label, url: sub.file, default: sub.file === defaultSub.file }))
                ],
                onSelect: (item) => {
                    newPlayer.subtitle.switch(item.url, {
                        name: item.html,
                        ...subtitleOptions 
                    });
                    return item.html;
                }
            });
            
            if (defaultSub) newPlayer.subtitle.switch(defaultSub.file, {
                name: defaultSub.label,
                ...subtitleOptions
            });
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
    populateSidebar({});
    populateBreadcrumbs({}); 

    const urlParams = new URLSearchParams(window.location.search);
    currentEpisodeId = urlParams.get('ep');

    if (!currentEpisodeId) {
        const container = document.querySelector('.watch-layout');
        if (container) container.innerHTML = `<div class="error-message">No episode ID provided.</div>`;
        return;
    }
    
    currentAnimeId = currentEpisodeId.split('?')[0];

    try {
        const [episodeData, animeDetailsResponse, scheduleDataResponse] = await Promise.all([
            fetchEpisodes(currentAnimeId),
            fetchAnimeDetails(currentAnimeId),
            fetchScheduleData(currentAnimeId)
        ]);
        
        const details = animeDetailsResponse?.results?.data;
        window.__animeDetails = details; // Store globally for reuse

        if (details) {
            populateSidebar(details);
            populateBreadcrumbs(details);
            setupSidebarEvents();
        }

        if (scheduleDataResponse?.nextEpisodeSchedule) {
            populateSelectorsWithSchedule(scheduleDataResponse);
        }
        
        renderEpisodeDropdown(episodeData.episodes || []);
        setupEventListeners();
        await loadPlayerForEpisode(currentEpisodeId, details);
        await loadComments(currentEpisodeId);
        setupCommentForm();
    } catch (err) {
        console.error("Failed to set up player page:", err);
        const container = document.querySelector('.watch-layout');
        if (container) container.innerHTML = `<div class="error-message">Failed to load page data.</div>`;
    }
}
