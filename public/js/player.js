import { fetchComments, postComment, fetchEpisodes, fetchServersForEpisode, fetchStreamData, PROXY_URL, PROXY_URL2, fetchAnimeDetails, fetchScheduleData } from './api.js';
import { getChapterStyles, updateChapterStyles } from './artPlayer/chapter.js';

let player = null;
let currentAnimeId = null;
let currentEpisodeId = null;

let introStart = 0;
let introEnd = 0;
let outroStart = 0;
let outroEnd = 0;

// Configurable debounce interval for saving watch progress
const DEBOUNCE_DELAY = 5000; // 5 seconds, configurable

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

// --- LocalStorage with expiry helpers ---
function setWithExpiry(key, value, ttlMs) {
    const now = Date.now();
    const item = {
        value: value,
        expiry: now + ttlMs,
    };
    localStorage.setItem(key, JSON.stringify(item));
}

export function getWithExpiry(key) {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return null;
    try {
        const item = JSON.parse(itemStr);
        if (!item.expiry || Date.now() > item.expiry) {
            localStorage.removeItem(key);
            return null;
        }
        return item.value;
    } catch {
        return null;
    }
}

/**
 * Saves the current watch progress to localStorage.
 * Stores under a consistent key, updates existing entries, removes completed episodes.
 * @param {Object} animeDetails - {id, title, poster}
 * @param {string} episodeId - The current episode ID
 * @param {number} currentTime - Current playback time in seconds
 * @param {number} duration - Video duration in seconds
 */
function saveWatchProgress(animeDetails, episodeId, currentTime, duration) {
    try {
        // Fallback for missing animeDetails
        const animeId = animeDetails?.id || episodeId.split('?')[0];
        const title = animeDetails?.title || "Unknown Title";
        const poster = animeDetails?.poster || "";

        // Only save if we have an episodeId and currentTime is valid
        if (!episodeId || currentTime <= 0) return;

        // Load watch history with expiry check
        const history = getWithExpiry('aniyumeWatchHistory') || [];

        // Update or add entry, keyed by episodeId
        history[episodeId] = {
            id: animeId,
            title: title,
            poster: poster,
            episodeId: episodeId,
            currentTime: Math.floor(currentTime),
            duration: Math.floor(duration),
            watchedAt: new Date().toISOString()
        };

        // Remove entry if episode is completed (currentTime >= duration)
        if (history[episodeId].currentTime >= history[episodeId].duration) {
            delete history[episodeId];
        }

        // Keep latest 12 entries only
        const sortedHistory = Object.values(history).sort((a, b) => new Date(b.watchedAt) - new Date(a.watchedAt));
        const limitedHistory = sortedHistory.slice(0, 12).reduce((acc, item) => {
            acc[item.episodeId] = item;
            return acc;
        }, {});

        // Save watch history with expiry
        setWithExpiry('aniyumeWatchHistory', limitedHistory, 24 * 60 * 60 * 1000);

        // Update Continue Watching section if on home page
        if (window.loadContinueWatching) {
            window.loadContinueWatching();
        }

        // Optional: debug
        // console.log("Watch progress saved:", limitedHistory);
    } catch (err) {
        console.error("Failed to save watch history:", err);
    }
}

// --- Debounce helper to limit how often a function is called ---
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
 * @param {string} newEpisodeId - The full ID of the new episode to play.
 */
// Make this an async function to use await
async function changeEpisode(newEpisodeId) {
    if (currentEpisodeId === newEpisodeId) return;

    currentEpisodeId = newEpisodeId;
    const url = new URL(window.location);
    url.searchParams.set('ep', newEpisodeId);
    history.pushState({ episodeId: newEpisodeId }, '', url.toString());

    playerManager.destroy();

    await loadPlayerForEpisode(newEpisodeId);
    await loadComments(newEpisodeId);
    // The call to setupCommentForm is now removed from here
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
async function loadPlayerForEpisode(fullEpisodeId, animeDetails, preferredServerDetails = null) {
    const playerContainer = document.getElementById('player');
    playerContainer.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading video player...</p>
        </div>
    `;
    
    // NEW: Read the start time ('t') from the URL for resuming playback
    const urlParams = new URLSearchParams(window.location.search);
    const startTime = parseInt(urlParams.get('t'), 10) || 0;

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

        // Extract intro/outro timestamps into globals
        const intro = streamData.streamingLink.intro;
        const outro = streamData.streamingLink.outro;
        if (intro) {
            introStart = intro.start;
            introEnd = intro.end;
        } else {
            introStart = 0;
            introEnd = 0;
        }
        if (outro) {
            outroStart = outro.start;
            outroEnd = outro.end;
        } else {
            outroStart = 0;
            outroEnd = 0;
        }
        
        // Inject custom styles for chapter progress bar
        updateChapterStyles(introStart, introEnd, outroStart, outroEnd);

        const subtitleOptions = {
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
        
        // Function to try a proxy URL and fall back if it fails
        async function tryProxyUrl(proxyUrl, proxyName) {
            return new Promise((resolve, reject) => {
                const testUrl = `${proxyUrl}m3u8-proxy?url=${encodeURIComponent(sourceUrl)}&headers=${encodeURIComponent(JSON.stringify(headers))}`;
                
                // Create a test player to see if the proxy works
                const testPlayer = new Artplayer({
                    url: testUrl,
                    container: document.createElement('div'),
                    type: 'm3u8',
                    autoplay: false,
                    muted: true,
                    volume: 0,
                    customType: {
                        m3u8: (video, url, art) => {
                            if (Hls.isSupported()) {
                                if (art.hls) art.hls.destroy();
                                const hls = new Hls({
                                    maxLoadingDelay: 5,
                                    lowLatencyMode: true,
                                    enableWorker: true,
                                });
                                
                                let errorTimeout = setTimeout(() => {
                                    hls.destroy();
                                    reject(new Error(`${proxyName} timeout`));
                                }, 10000); // 10 second timeout
                                
                                hls.on(Hls.Events.ERROR, function (event, data) {
                                    clearTimeout(errorTimeout);
                                    if (data.fatal) {
                                        hls.destroy();
                                        reject(new Error(`${proxyName} error: ${data.type}`));
                                    }
                                });
                                
                                hls.on(Hls.Events.MANIFEST_PARSED, function () {
                                    clearTimeout(errorTimeout);
                                    hls.destroy();
                                    resolve(testUrl);
                                });
                                
                                hls.loadSource(url);
                                hls.attachMedia(video);
                                art.hls = hls;
                            } else {
                                reject(new Error('HLS not supported'));
                            }
                        }
                    }
                });
                
                // Clean up test player after a short time
                setTimeout(() => {
                    testPlayer.destroy();
                }, 100);
            });
        }
        
        // Try PROXY_URL first, then fall back to PROXY_URL2
        let finalProxyUrl;
        try {
            finalProxyUrl = await tryProxyUrl(PROXY_URL, 'Primary Proxy');
            console.log('Using primary proxy:', PROXY_URL);
        } catch (primaryError) {
            console.warn('Primary proxy failed, trying fallback:', primaryError.message);
            try {
                finalProxyUrl = await tryProxyUrl(PROXY_URL2, 'Fallback Proxy');
                console.log('Using fallback proxy:', PROXY_URL2);
            } catch (fallbackError) {
                throw new Error(`Both proxies failed: ${primaryError.message}, ${fallbackError.message}`);
            }
        }
        
        playerContainer.innerHTML = "";
        
        const newPlayer = new Artplayer({
            url: finalProxyUrl,
            container: playerContainer,
            type: 'm3u8',
            volume: parseFloat(getWithExpiry('player-volume')) || 0.7,
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
            startTime: startTime, // NEW: This tells the player where to start
            subtitle: subtitleOptions, 
            moreVideoAttr: { 
                crossOrigin: 'anonymous',
                preload: 'none',
                playsInline: true 
            },
            controls: [
                {
                    position: 'right',
                    html: '<svg viewBox="-5 -10 75 75" xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M11.9199 45H7.20508V26.5391L2.60645 28.3154V24.3975L11.4219 20.7949H11.9199V45ZM30.1013 35.0059C30.1013 38.3483 29.4926 40.9049 28.2751 42.6758C27.0687 44.4466 25.3422 45.332 23.0954 45.332C20.8708 45.332 19.1498 44.4743 17.9323 42.7588C16.726 41.0322 16.1006 38.5641 16.0564 35.3545V30.7891C16.0564 27.4577 16.6596 24.9121 17.8659 23.1523C19.0723 21.3815 20.8044 20.4961 23.0622 20.4961C25.32 20.4961 27.0521 21.3704 28.2585 23.1191C29.4649 24.8678 30.0792 27.3636 30.1013 30.6064V35.0059ZM25.3864 30.1084C25.3864 28.2048 25.1983 26.777 24.822 25.8252C24.4457 24.8734 23.8591 24.3975 23.0622 24.3975C21.5681 24.3975 20.7933 26.1406 20.738 29.627V35.6533C20.738 37.6012 20.9262 39.0511 21.3025 40.0029C21.6898 40.9548 22.2875 41.4307 23.0954 41.4307C23.8591 41.4307 24.4236 40.988 24.7888 40.1025C25.1651 39.2061 25.3643 37.8392 25.3864 36.002V30.1084Z" fill="white"></path><path d="M11.9894 5.45398V0L2 7.79529L11.9894 15.5914V10.3033H47.0886V40.1506H33.2442V45H52V5.45398H11.9894Z" fill="white"></path></svg>',
                    tooltip: 'Backward 10s',
                    click: () => playerManager.get() && (playerManager.get().backward = 10),
                },
                {
                    position: 'right',
                    html: '<svg viewBox="-5 -10 75 75" xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M29.9199 45H25.2051V26.5391L20.6064 28.3154V24.3975L29.4219 20.7949H29.9199V45ZM48.1013 35.0059C48.1013 38.3483 47.4926 40.9049 46.2751 42.6758C45.0687 44.4466 43.3422 45.332 41.0954 45.332C38.8708 45.332 37.1498 44.4743 35.9323 42.7588C34.726 41.0322 34.1006 38.5641 34.0564 35.3545V30.7891C34.0564 27.4577 34.6596 24.9121 35.8659 23.1523C37.0723 21.3815 38.8044 20.4961 41.0622 20.4961C43.32 20.4961 45.0521 21.3704 46.2585 23.1191C47.4649 24.8678 48.0792 27.3636 48.1013 30.6064V35.0059ZM43.3864 30.1084C43.3864 28.2048 43.1983 26.777 42.822 25.8252C42.4457 24.8734 41.8591 24.3975 41.0622 24.3975C39.5681 24.3975 38.7933 26.1406 38.738 29.627V35.6533C38.738 37.6012 38.9262 39.0511 39.3025 40.0029C39.6898 40.9548 40.2875 41.4307 41.0954 41.4307C41.8591 41.4307 42.4236 40.988 42.7888 40.1025C43.1651 39.2061 43.3643 37.8392 43.3864 36.002V30.1084Z" fill="white"></path><path d="M40.0106 5.45398V0L50 7.79529L40.0106 15.5914V10.3033H4.9114V40.1506H18.7558V45H2.01875e-06V5.45398H40.0106Z" fill="white"></path></svg>',
                    tooltip: 'Forward 10s',
                    click: () => playerManager.get() && (playerManager.get().forward = 10),
                },
            ],
            plugins: [
                artplayerPluginChapter({
                    chapters: [
                        ...(introStart && introEnd ? [{ start: introStart, end: introEnd, title: 'Intro' }] : []),
                        ...(outroStart && outroEnd ? [{ start: outroStart, end: outroEnd, title: 'Outro' }] : [])
                    ]
                })
            ],
            customType: {
                m3u8: (video, url, art) => {
                    if (Hls.isSupported()) {
                        if (art.hls) art.hls.destroy();
                        const hls = new Hls();

                        hls.on(Hls.Events.ERROR, function (event, data) {
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
                        }, DEBOUNCE_DELAY);

                        // attach debounced saver
                        art.on('timeupdate', debouncedSave);
                        
                        // create named beforeunload handler so we can remove it later
                        const onBeforeUnload = () => {
                            try {
                                if (art && art.video) {
                                    saveWatchProgress(animeDetails, fullEpisodeId, art.video.currentTime, art.video.duration);
                                }
                            } catch (e) {
                                // ignore
                            }
                        };
                        window.addEventListener("beforeunload", onBeforeUnload);

                        art.on("destroy", () => {
                            try { hls.destroy(); } catch (e) {}
                            try { window.removeEventListener("beforeunload", onBeforeUnload); } catch (e) {}
                        });

                        hls.on(Hls.Events.MANIFEST_PARSED, () => addQualitySetting(art, hls));
                    } else {
                        video.src = url;
                    }
                }
            },
        });
        playerManager.set(newPlayer);

        newPlayer.on('volumeChange', (volume) => {
            setWithExpiry('player-volume', volume, 24 * 60 * 60 * 1000);
        });


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
        playerContainer.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Failed to load video</h3>
                <p>${err.message}</p>
                <button class="retry-btn" onclick="location.reload()">Try Again</button>
            </div>
        `;
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
        if (container) container.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>No Episode Selected</h3>
                <p>Please select an episode to start watching.</p>
            </div>
        `;
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
        await loadPlayerForEpisode(currentEpisodeId, details); // Pass 'details' here
        await loadComments(currentEpisodeId);
        setupCommentForm();
    } catch (err) {
        console.error("Failed to set up player page:", err);
        const container = document.querySelector('.watch-layout');
        if (container) container.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Failed to Load Page</h3>
                <p>Please check your connection and try again.</p>
                <button class="retry-btn" onclick="location.reload()">Reload Page</button>
            </div>
        `;
    }
}


/**
 * Populates the sidebar with anime poster and metadata.
 * @param {Object} details - The anime details object from the API.
 */
function populateSidebar(details) {
    const poster = document.querySelector('.sidebar-poster');
    const description = document.querySelector('.sidebar-description');
    const detailsContainer = document.querySelector('.sidebar-details');

    // Return early if the necessary elements aren't found
    if (!poster || !description || !detailsContainer) return;

    poster.classList.add('skeleton');
    poster.innerHTML = ''; // Clear previous image
    if (details.poster) {
        poster.innerHTML = `
            <div class="poster-container">
                <img src="${details.poster}" alt="${details.title || 'Anime'} Poster" loading="lazy" onerror="this.style.display='none'">
                <div class="poster-overlay">
                    <i class="fas fa-play"></i>
                </div>
            </div>
        `;
    }
    
    detailsContainer.innerHTML = `
        <div class="detail-item">
            <i class="fas fa-tv"></i>
            <span><strong>Type:</strong> ${details.showType || 'N/A'}</span>
        </div>
        <div class="detail-item">
            <i class="fas fa-circle"></i>
            <span><strong>Status:</strong> ${details.animeInfo?.Status || 'N/A'}</span>
        </div>
        <div class="detail-item">
            <i class="fas fa-calendar"></i>
            <span><strong>Premiere:</strong> ${details.animeInfo?.Aired?.match(/\d{4}/)?.[0] || 'N/A'}</span>
        </div>
        <div class="detail-item">
            <i class="fas fa-star"></i>
            <span><strong>Score:</strong> ${details.animeInfo?.["MAL Score"] || 'N/A'}</span>
        </div>
    `;
}

/**
 * Populates the breadcrumb navigation.
 * @param {Object} details - The anime details object from the API.
 */
function populateBreadcrumbs(details) {
    const typeElement = document.querySelector('.breadcrumb-type');
    const currentElement = document.querySelector('.breadcrumb-current');

    if (typeElement && currentElement) {
        typeElement.textContent = details.showType || 'TV';
        currentElement.textContent = details.title ? `Watching ${details.title}` : 'Loading...';
    }
}

/**
 * Populates the next episode schedule.
 * @param {Object} scheduleData - The schedule data object from the API.
 */
function populateSelectorsWithSchedule(scheduleData) {
    const nextEpisodeContainer = document.getElementById('next-episode-container');
    if (!nextEpisodeContainer) return;

    try {
        const nextEpisodeDate = new Date(scheduleData.nextEpisodeSchedule);
        const formattedDate = nextEpisodeDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            timeZoneName: 'short'
        });

        nextEpisodeContainer.innerHTML = `
            <div class="schedule-card">
                <div class="schedule-header">
                    <i class="fas fa-clock"></i>
                    <h3>Next Episode</h3>
                </div>
                <div class="schedule-time">
                    <i class="fas fa-calendar-day"></i>
                    <span>${formattedDate}</span>
                </div>
            </div>
        `;
    } catch (error) {
        console.error("Error parsing next episode schedule date:", error);
        nextEpisodeContainer.innerHTML = `
            <div class="schedule-card">
                <div class="schedule-header">
                    <i class="fas fa-clock"></i>
                    <h3>Next Episode</h3>
                </div>
                <div class="schedule-time">
                    <i class="fas fa-question-circle"></i>
                    <span>Date unavailable</span>
                </div>
            </div>
        `;
    }
}

/**
 * Sets up event listeners for sidebar elements like the "See More" button.
 */
function setupSidebarEvents() {
    const seeMoreBtn = document.querySelector('.see-more-btn');
    const description = document.querySelector('.sidebar-description');

    if (seeMoreBtn && description) {
        // Only show the button if the description is actually overflowing
        if (description.scrollHeight > description.clientHeight) {
            seeMoreBtn.style.display = 'flex';
        } else {
            seeMoreBtn.style.display = 'none';
        }

        seeMoreBtn.addEventListener('click', () => {
            description.classList.toggle('expanded');
            if (description.classList.contains('expanded')) {
                seeMoreBtn.innerHTML = '<i class="fas fa-chevron-up"></i> See Less';
            } else {
                seeMoreBtn.innerHTML = '<i class="fas fa-chevron-down"></i> See More';
            }
        });
    }
}

async function loadComments(episodeId) {
  const commentList = document.getElementById("comment-list");
  if (!commentList) return;

  commentList.innerHTML = `
    <div class="comments-loading">
        <div class="spinner small"></div>
        <p>Loading comments...</p>
    </div>
  `;

  // 1. Fetch the entire response object from the API.
  const responseData = await fetchComments(episodeId);

  // 2. Extract the actual comments array from the "comments" property.
  const comments = responseData.comments;

  // 3. Now, check if the extracted array is empty.
  if (!comments || comments.length === 0) {
    commentList.innerHTML = `
        <div class="no-comments">
            <i class="fas fa-comments"></i>
            <h4>No comments yet</h4>
            <p>Be the first to share your thoughts!</p>
        </div>
    `;
    return;
  }

  // 4. Map over the correct array to display the comments.
  commentList.innerHTML = comments.map(c => `
    <div class="comment-card">
        <div class="comment-header">
            <div class="user-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="comment-meta">
                <strong class="username">${c.username}</strong>
                <span class="timestamp">${new Date(c.timestamp).toLocaleString()}</span>
            </div>
        </div>
        <div class="comment-content">
            <p>${c.comment}</p>
        </div>
    </div>
  `).join("");
}

function setupCommentForm() {
  const section = document.querySelector(".comment-section");
  if (!section) return;

  const textarea = section.querySelector(".comment-box");
  const button = section.querySelector(".comment-btn");

  // A single event listener that reads the current episode ID on click
  button.addEventListener("click", async () => {
    const comment = textarea.value.trim();
    if (!comment) {
        textarea.classList.add('error');
        setTimeout(() => textarea.classList.remove('error'), 2000);
        return;
    }

    const username = `anonymous-${Math.random().toString(36).substring(2, 6)}`;

    // Show loading state
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
    button.disabled = true;

    // Use the module-level 'currentEpisodeId' which is always up-to-date
    await postComment({ username, comment, episodeId: currentEpisodeId });
    
    // Reset button state
    button.innerHTML = '<i class="fas fa-paper-plane"></i> Post Comment';
    button.disabled = false;
    
    textarea.value = "";
    loadComments(currentEpisodeId); // refresh comments with the correct ID
  });

  // Add input event to show character count
  textarea.addEventListener('input', () => {
    const charCount = textarea.value.length;
    let counter = textarea.parentNode.querySelector('.char-counter');
    if (!counter) {
        counter = document.createElement('div');
        counter.className = 'char-counter';
        textarea.parentNode.appendChild(counter);
    }
    counter.textContent = `${charCount}/500`;
    
    if (charCount > 500) {
        counter.classList.add('error');
    } else {
        counter.classList.remove('error');
    }
  });
}
