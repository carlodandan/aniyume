// Import API functions
import { fetchHomeData, fetchAnimeDetails, fetchRecentlyUpdatedAnime, fetchEpisodes, fetchMostPopularAnime } from './api.js';
// Import the player initializer and the new player manager
import { initPlayer, playerManager } from './player.js';

let currentInfoPageAnimeId = null;

function handleGoHome() {
    playerManager.destroy(); // Use the manager to safely destroy the player
    showPage('home');
}

// Page navigation
function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // Remove 'active' class from all nav links
    document.querySelectorAll('nav a').forEach(link => {
        link.classList.remove('active');
    });

    // Show the target page
    const pageElement = document.getElementById(`${pageId}-page`);
    if (pageElement) {
        pageElement.classList.add('active');
    }

    // Add 'active' class to the correct nav link
    const activeLink = document.querySelector(`nav a[onclick*="showPage('${pageId}')"]`) || document.querySelector(`nav a[onclick*="handleGoHome()"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    // Update the browser URL and history
    if (pageId !== 'watch') { // The watch URL is handled by navigateToPlayer
        const path = pageId === 'home' ? '/' : `/${pageId}`;
        if (window.location.pathname !== path) {
             history.pushState({pageId: pageId}, null, path);
        }
    }

    // Run page-specific functions
    if (pageId === 'watch') {
        initPlayer();
    } else if (pageId === 'home') {
        loadTrendingAnime();
    } else if (pageId === 'info') {
        initInfoPage();
    } else if (pageId === 'popular') { // Add this case
        loadMostPopularAnime();
    } else if (pageId === 'recently-updated') {
        loadRecentlyUpdatedAnime();
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
        trendingGrid.innerHTML = '<div class="loading">Loading trending anime...</div>';
        const homeData = await fetchHomeData();
        let trendingAnime = [];
        if (homeData && homeData.results && Array.isArray(homeData.results.trending)) {
            trendingAnime = homeData.results.trending;
        }

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

// Load recently updated anime from API
async function loadRecentlyUpdatedAnime() {
    const grid = document.querySelector('.recently-updated-grid');
    if (!grid) return;

    try {
        grid.innerHTML = '<div class="loading">Loading recently updated anime...</div>';
        const data = await fetchRecentlyUpdatedAnime();
        const animeList = data.results.data;

        if (animeList && animeList.length > 0) {
            grid.innerHTML = animeList.map(anime => createAnimeCard(anime)).join('');
        } else {
            grid.innerHTML = '<div class="no-data">No recently updated anime available</div>';
        }
    } catch (error) {
        console.error('Error loading recently updated anime:', error);
        grid.innerHTML = '<div class="error">Failed to load recently updated anime. Please try again later.</div>';
    }
}

// Load most popular anime from API
async function loadMostPopularAnime() {
    const grid = document.querySelector('.popular-grid');
    if (!grid) return;

    try {
        grid.innerHTML = '<div class="loading">Loading most popular anime...</div>';
        const data = await fetchMostPopularAnime();
        // Corrected line to access the nested data array
        const animeList = data.results.data;

        if (animeList && animeList.length > 0) {
            grid.innerHTML = animeList.map(anime => createAnimeCard(anime)).join('');
        } else {
            grid.innerHTML = '<div class="no-data">No popular anime available</div>';
        }
    } catch (error) {
        console.error('Error loading most popular anime:', error);
        grid.innerHTML = '<div class="error">Failed to load most popular anime. Please try again later.</div>';
    }
}

// Create anime card HTML
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

// Function to handle anime card clicks and navigate to player
function showAnimePlayer(animeId) {
    localStorage.setItem('selectedAnimeId', animeId);
    showPage('player');
}

async function navigateToPlayer(animeId) {
    try {
        // fetchEpisodes now returns an object: { totalEpisodes, episodes }
        const episodeData = await fetchEpisodes(animeId);

        // Access the nested .episodes array
        const episodes = episodeData.episodes;

        if (!episodes || episodes.length === 0) {
            throw new Error("No episodes found for this anime.");
        }

        // Now we can safely get the first episode
        const firstEpisode = episodes[0];
        const fullEpisodeId = firstEpisode.id;

        const url = `/watch?ep=${encodeURIComponent(fullEpisodeId)}`;
        history.pushState({ pageId: 'watch', episodeId: fullEpisodeId }, null, url);
        showPage('watch');
    } catch (error) {
        console.error("Failed to navigate to player:", error);
        alert("Could not load episodes for this anime. Please try again later.");
    }
}


function watchAnimeFromInfo() {
    if (!currentInfoPageAnimeId) {
        console.error("Could not find the anime ID to play.");
        return;
    }
    navigateToPlayer(currentInfoPageAnimeId);
}

// Load info page details
async function loadInfoPage(animeId) {
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
        const apiResponse = await fetchAnimeDetails(animeId);
        const details = apiResponse.results?.data;

        if (!details) {
            title.textContent = 'Anime Not Found';
            description.textContent = 'The details for this anime could not be loaded.';
            poster.src = 'https://via.placeholder.com/300x400?text=Not+Found';
            return;
        }

        poster.src = details.poster || 'https://via.placeholder.com/300x400?text=No+Image';
        poster.alt = `${details.title} poster`;
        title.textContent = details.title || 'Unknown Title';

        const airedYear = details.animeInfo?.Aired?.match(/\d{4}/)?.[0] || 'N/A';
        const duration = details.animeInfo?.Duration || 'N/A';
        const malScore = details.animeInfo?.["MAL Score"] || 'N/A';

        meta.innerHTML = `
            <span><strong class="meta-key">Type:</strong> ${details.showType || 'TV'}</span>
            <span><strong class="meta-key">Premiere:</strong> ${airedYear}</span>
            <span><strong class="meta-key">Duration:</strong> ${duration}</span>
            <span class="anime-rating"><strong class="meta-key">Rating:</strong> <i class="fas fa-star"></i> ${malScore}</span>
        `;

        description.textContent = details.animeInfo?.Overview || 'No description available.';
        tags.innerHTML = details.animeInfo?.Genres?.map(genre => `<span class="tag">${genre}</span>`).join('') || '';
    } catch (error) {
        console.error('Error loading anime info:', error);
        title.textContent = 'Error loading anime info';
        description.textContent = 'Please try again later.';
        poster.src = 'https://via.placeholder.com/300x400?text=Error';
    }
}

function goBack() {
    history.back();
}

function showInfoPage(animeId) {
    if (!animeId) return;
    currentInfoPageAnimeId = animeId;
    history.pushState(null, '', `/info?id=${animeId}`);
    showPage('info');
    loadInfoPage(animeId);
}

function initInfoPage() {
    // Currently handled by loadInfoPage in showInfoPage
}

// Make functions globally accessible for onclick attributes in HTML
window.showPage = showPage;
window.toggleMenu = toggleMenu;
window.goBack = goBack;
window.showInfoPage = showInfoPage;
window.watchAnimeFromInfo = watchAnimeFromInfo;
window.handleGoHome = handleGoHome;

// Initialize the page and set up routing
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const path = window.location.pathname;

    if (path === '/popular') {
        showPage('popular');
    } else if (path === '/watch' && urlParams.has('ep')) {
        showPage('watch');
    } else if (path === '/info' && urlParams.has('id')) {
        const animeId = urlParams.get('id');
        showInfoPage(animeId);
    } else if (path === '/recently-updated') {
        showPage('recently-updated');
    } else {
        showPage('home');
    }

    // Set up search functionality
    const searchInput = document.querySelector('.search-input');
    searchInput.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') {
            alert(`Searching for: ${this.value}`);
            this.value = '';
        }
    });

    // Handle browser back/forward navigation
    window.addEventListener('popstate', function(event) {
        const path = window.location.pathname;
        const urlParams = new URLSearchParams(window.location.search);

        if (path === '/popular') {
            showPage('popular');
        } else if (path.startsWith('/watch') && urlParams.has('ep')) {
            showPage('watch');
        } else if (path.startsWith('/info') && urlParams.has('id')) {
            const animeId = urlParams.get('id');
            showPage('info');
            loadInfoPage(animeId);
        } else if (path === '/recently-updated') {
            showPage('recently-updated');
        } else {
            showPage('home');
        }
    });
});