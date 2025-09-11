// Import API functions
import { fetchHomeData, fetchAnimeDetails } from './api.js';

// Page navigation
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    document.querySelectorAll('nav a').forEach(link => {
        link.classList.remove('active');
    });

    const pageElement = document.getElementById(`${pageId}-page`);
    if (pageElement) {
        pageElement.classList.add('active');
    }

    if (pageId === 'player') {
        initPlayer();
    } else if (pageId === 'home') {
        loadTrendingAnime();
    } else if (pageId === 'info') {
        initInfoPage();
    }
}

// Mobile menu toggle
function toggleMenu() {
    const nav = document.getElementById('nav');
    nav.classList.toggle('active');
}

// Load trending anime from API
async function loadTrendingAnime() {
    const trendingGrid = document.querySelector('.trending-grid');
    if (!trendingGrid) return;

    try {
        // Show loading state
        trendingGrid.innerHTML = '<div class="loading">Loading trending anime...</div>';

        // Fetch trending data from API
        const homeData = await fetchHomeData();

        // Extract trending anime from the response
        let trendingAnime = [];
        if (homeData && homeData.results && Array.isArray(homeData.results.trending)) {
            trendingAnime = homeData.results.trending;
        }

        // Render trending anime cards
        if (trendingAnime.length > 0) {
            trendingGrid.innerHTML = trendingAnime.map(anime => createAnimeCard(anime)).join('');
        } else {
            trendingGrid.innerHTML = '<div class="no-data">No trending anime available</div>';
        }

    } catch (error) {
        console.error('Error loading trending anime:', error);
        trendingGrid.innerHTML = '<div class="error">Failed to load trending anime. Please try again later.</div>';
    }
}

// Create anime card HTML (vertical style, with optional trending number)
function createAnimeCard(anime) {
    const title = anime.title || anime.name || 'Unknown Title';
    const image = anime.poster || anime.image || 'https://via.placeholder.com/300x400?text=No+Image';
    const type = anime.type || (anime.tvInfo && anime.tvInfo.showType) || 'TV';
    const rank = anime.number || null;
    const id = anime.id || anime.data_id || Math.random();

    return `
        <div class="anime-card-vertical" onclick="showInfoPage('${id}')">
            ${rank ? `<div class="trending-rank"># ${rank}</div>` : ""}
            <img src="${image}" alt="${title} poster" class="anime-thumb-vertical"
                onerror="this.src='https://via.placeholder.com/300x400?text=No+Image'">
            <div class="anime-info">
                <h3 class="anime-title">${title}</h3>
                <div class="anime-meta">
                    <span>${type}</span>
                </div>
            </div>
        </div>
    `;
}


// Function to handle anime card clicks
function showAnimePlayer(animeId) {
    // Store the anime ID for the player page
    localStorage.setItem('selectedAnimeId', animeId);
    showPage('player');
}
window.showAnimePlayer = showAnimePlayer; // Make it globally accessible for onclick

// Show info page for anime
function showInfoPage(animeId) {
    if (!animeId) return;
    history.pushState(null, '', `/info?id=${animeId}`);
    showPage('info');
    loadInfoPage(animeId);
}
window.showInfoPage = showInfoPage; // Make it globally accessible for onclick

// Load info page details
async function loadInfoPage(animeId) {
    console.log('loadInfoPage called with animeId:', animeId);
    const poster = document.querySelector('.anime-poster-info');
    const title = document.querySelector('.anime-title-info');
    const meta = document.querySelector('.detail-meta-info');
    const description = document.querySelector('.detail-description-info');
    const tags = document.querySelector('.detail-tags-info');

    poster.src = '';
    poster.alt = '';
    title.textContent = 'Loading...';
    meta.innerHTML = '';
    description.textContent = '';
    tags.innerHTML = '';

    try {
        const animeData = await fetchAnimeDetails(animeId);
        console.log('fetchAnimeDetails response:', animeData);
        console.log('Keys in results:', Object.keys(animeData.results || {}));
        console.log('Sample results content:', animeData.results);
        // Try to find the correct details object
        let details = animeData.results?.data;
        if (!details) {
            // Try alternative keys if data is not found
            const keys = Object.keys(animeData.results || {});
            if (keys.length > 0) {
                // Use 'data' key explicitly since keys are ['data', 'seasons']
                if (keys.includes('data')) {
                    details = animeData.results['data'];
                } else {
                    details = animeData.results[keys[0]];
                }
            }
        }

        if (!details) {
            title.textContent = 'Anime Not Found';
            description.textContent = 'The details for this anime could not be loaded.';
            poster.src = 'https://via.placeholder.com/300x400?text=Not+Found';
            return;
        }

        poster.src = details.poster || 'https://via.placeholder.com/300x400?text=No+Image';
        poster.alt = `${details.title} poster`;
        console.log('Setting title:', details.title);
        title.textContent = details.title || 'Unknown Title';
        console.log('Title set:', title.textContent);

        const airedYear = details.animeInfo?.Aired?.match(/\d{4}/)?.[0] || 'N/A';
        const duration = details.animeInfo?.Duration || 'N/A';
        const malScore = details.animeInfo?.['MAL Score'] || 'N/A';

        meta.innerHTML = `
            <span>${details.showType || 'TV'}</span>
            <span>${airedYear}</span>
            <span>${duration}</span>
            <span class="anime-rating"><i class="fas fa-star"></i> ${malScore}</span>
        `;
        console.log('Meta set:', meta.innerHTML);

        description.textContent = details.animeInfo?.Overview || 'No description available.';
        console.log('Description set:', description.textContent);
        tags.innerHTML = details.animeInfo?.Genres?.map(genre => `<span class="tag">${genre}</span>`).join('') || '';
        console.log('Tags set:', tags.innerHTML);
    } catch (error) {
        console.error('Error loading anime info:', error);
        title.textContent = 'Error loading anime info';
        description.textContent = 'Please try again later.';
        poster.src = 'https://via.placeholder.com/300x400?text=Error';
    }
}

// Go back function for info page
function goBack() {
    history.back();
}
window.goBack = goBack;

// Initialize info page (placeholder for future enhancements)
function initInfoPage() {
    // Currently handled by loadInfoPage in showInfoPage
}

// Update player page with anime details
function updatePlayerPageDetails(details) {
    const playerPage = document.getElementById('player-page');
    const poster = playerPage.querySelector('.anime-poster');
    const title = playerPage.querySelector('.detail-content h2');
    const meta = playerPage.querySelector('.detail-meta');
    const description = playerPage.querySelector('.detail-description');
    const tags = playerPage.querySelector('.detail-tags');

    if (!details) {
        title.textContent = 'Anime Not Found';
        description.textContent = 'The details for this anime could not be loaded. Please go back and try again.';
        poster.src = 'https://via.placeholder.com/300x400?text=Not+Found';
        meta.innerHTML = '';
        tags.innerHTML = '';
        return;
    }

    const animeData = details.data;

    poster.src = animeData.poster || 'https://via.placeholder.com/300x400?text=No+Image';
    poster.alt = `${animeData.title} poster`;
    title.textContent = animeData.title || 'Unknown Title';

    const airedYear = animeData.animeInfo?.Aired?.match(/\d{4}/)?.[0] || 'N/A';
    const duration = animeData.animeInfo?.Duration || 'N/A';
    const malScore = animeData.animeInfo?.['MAL Score'] || 'N/A';

    meta.innerHTML = `
        <span>${animeData.showType || 'TV'}</span>
        <span>${airedYear}</span>
        <span>${duration}</span>
        <span class="anime-rating"><i class="fas fa-star"></i> ${malScore}</span>
    `;

    description.textContent = animeData.animeInfo?.Overview || 'No description available.';

    tags.innerHTML = animeData.animeInfo?.Genres?.map(genre => `<span class="tag">${genre}</span>`).join('') || '';
}

// Initialize video player
async function initPlayer() {
    // Destroy existing player if any
    if (window.artplayer) {
        window.artplayer.destroy();
    }

    // Create new player
    window.artplayer = new Artplayer({
        container: '#player',
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        poster: 'https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/c9901b2b-69fb-4719-a0c4-ce9061ec9278.png',
        volume: 0.5,
        isLive: false,
        muted: false,
        autoplay: false,
        pip: true,
        autoSize: true,
        autoMini: true,
        screenshot: true,
        setting: true,
        loop: false,
        flip: true,
        playbackRate: true,
        aspectRatio: true,
        fullscreen: true,
        fullscreenWeb: true,
        subtitleOffset: true,
        miniProgressBar: true,
        mutex: true,
        backdrop: true,
        playsInline: true,
        autoPlayback: true,
        airplay: true,
        theme: '#8b5cf6',
        lang: navigator.language.toLowerCase(),
        moreVideoAttr: {
            crossOrigin: 'anonymous',
        },
        settings: [
            {
                html: 'Subtitle',
                tooltip: 'English',
                selector: [
                    {
                        html: 'Display',
                        tooltip: 'Show',
                        switch: true,
                        onSwitch: function (item) {
                            item.tooltip = item.switch ? 'Hide' : 'Show';
                            window.artplayer.subtitle.show = !item.switch;
                            return !item.switch;
                        },
                    },
                ],
            },
        ],
        contextmenu: [
            {
                html: 'Info',
                click: function () {
                    console.log('You clicked the info menu');
                },
            },
        ],
        controls: [
            {
                position: 'right',
                html: '<i class="fas fa-cog"></i>',
                tooltip: 'Settings',
                click: function () {
                    window.artplayer.setting.show = !window.artplayer.setting.show;
                },
            },
        ],
    });

    // HLS initialization
    if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8');
        hls.attachMedia(window.artplayer.video);
    } else if (window.artplayer.video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        window.artplayer.video.src = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
    }

    // Fetch and display anime details
    const animeId = localStorage.getItem('selectedAnimeId');
    if (!animeId) {
        console.error('No anime ID found for player page');
        updatePlayerPageDetails(null);
        return;
    }

    try {
        const animeData = await fetchAnimeDetails(animeId);
        updatePlayerPageDetails(animeData.results);
    } catch (error) {
        console.error('Error loading anime details:', error);
        updatePlayerPageDetails(null);
    }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const path = window.location.pathname;

    if (path === '/info' && urlParams.has('id')) {
        const animeId = urlParams.get('id');
        showInfoPage(animeId);
    } else {
        // Load trending anime on page load
        loadTrendingAnime();

        // Set up episode buttons
        document.querySelectorAll('.episode-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.episode-btn').forEach(b => {
                    b.classList.remove('active');
                });
                this.classList.add('active');
                // In a real app, you would change the video source here
            });
        });

        // Set up search functionality
        const searchInput = document.querySelector('.search-input');
        searchInput.addEventListener('keyup', function(e) {
            if (e.key === 'Enter') {
                alert(`Searching for: ${this.value}`);
                this.value = '';
            }
        });
    }
});
