// Import API functions
import { fetchHomeData, fetchAnimeDetails, fetchRecentlyUpdatedAnime, fetchEpisodes, fetchMostPopularAnime, fetchRecentAnime, fetchAnimeByGenre, fetchAnimeByAZ } from './api.js';
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
    if (pageId !== 'watch' && pageId !== 'browse-results') { // The watch and browse-results URLs are handled by their own navigation functions
        const path = pageId === 'home' ? '/' : `/${pageId}`;
        // Avoid pushing state if it's the same as the current one
        if (window.location.pathname !== path || window.location.search) {
             history.pushState({pageId: pageId}, null, path);
        }
    }

    // Run page-specific functions
    if (pageId === 'browse') {
        initBrowsePage();
    } else if (pageId === 'watch') {
        initPlayer();
    } else if (pageId === 'home') {
        loadTrendingAnime();
    } else if (pageId === 'info') {
        initInfoPage();
    } else if (pageId === 'popular') { // Add this case
        loadMostPopularAnime();
    } else if (pageId === 'new') {
        loadNewAnime();
    } else if (pageId === 'recently-updated') {
        loadRecentlyUpdatedAnime();
    } else if (pageId === 'browse-results') {
        // This needs to be called after the page is shown
        loadBrowseResultsPage();
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

        // Populate hero collage
        if (homeData?.results?.spotlights) {
            loadHeroCollage(homeData.results.spotlights);
        }

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

// Create hero collage background
function loadHeroCollage(spotlights) {
    const collageContainer = document.querySelector('.hero-collage-bg');
    if (!collageContainer || !spotlights || spotlights.length === 0) return;

    // Use up to 8 images for the collage for a good visual density
    const images = spotlights.slice(0, 8).map(anime => `<img src="${anime.poster}" alt="">`).join('');
    collageContainer.innerHTML = images;
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

// Load new anime from API
async function loadNewAnime() {
    const grid = document.querySelector('#new-page .anime-grid');
    if (!grid) return;

    try {
        grid.innerHTML = '<div class="loading">Loading new anime...</div>';
        // This uses the /recently-added endpoint
        const data = await fetchRecentAnime();
        const animeList = data.results.data;

        if (animeList && animeList.length > 0) {
            grid.innerHTML = animeList.map(anime => createAnimeCard(anime)).join('');
        } else {
            grid.innerHTML = '<div class="no-data">No new anime available</div>';
        }
    } catch (error) {
        console.error('Error loading new anime:', error);
        grid.innerHTML = '<div class="error">Failed to load new anime. Please try again later.</div>';
    }
}

// --- Browse Page Logic ---

const genres = [
    'action', 'adventure', 'cars', 'comedy', 'dementia', 'demons', 'drama', 'ecchi', 'fantasy', 'game', 'harem',
    'historical', 'horror', 'isekai', 'josei', 'kids', 'magic', 'martial-arts', 'mecha', 'military', 'music',
    'mystery', 'parody', 'police', 'psychological', 'romance', 'samurai', 'school', 'sci-fi', 'seinen', 'shoujo',
    'shoujo-ai', 'shounen', 'shounen-ai', 'slice-of-life', 'space', 'sports', 'super-power', 'supernatural',
    'thriller', 'vampire'
];

const azList = [
    'other', '0-9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'
];

function initBrowsePage() {
    const genreContainer = document.getElementById('genre-list');
    const azContainer = document.getElementById('az-list');

    if (genreContainer.childElementCount === 0) {
        genreContainer.innerHTML = genres.map(genre =>
            `<a href="/browse/genre/${genre}" onclick="event.preventDefault(); navigateToBrowseResults('genre', '${genre}')">${genre.charAt(0).toUpperCase() + genre.slice(1)}</a>`
        ).join('');
    }

    if (azContainer.childElementCount === 0) {
        azContainer.innerHTML = azList.map(item => {
            const value = item === '#' ? 'other' : item;
            return `<a href="/browse/az/${value}" onclick="event.preventDefault(); navigateToBrowseResults('az', '${value}')">${item.toUpperCase()}</a>`
        }).join('');
    }
}

// Called only when user clicks a genre or A-Z link
async function loadBrowseResultsPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const pathParts = window.location.pathname.split('/').filter(p => p);
    const type = pathParts[1]; // genre or az
    const value = pathParts[2]; // action, comedy, a, etc.
    const page = parseInt(urlParams.get('page') || '1', 10);

    const grid = document.getElementById('browse-results-grid');
    const titleEl = document.getElementById('browse-results-title');

    grid.innerHTML = '<div class="loading">Loading anime...</div>';
    titleEl.textContent = `Results for: ${value || 'Unknown'} (Page ${page})`;

    let data;
    try {
        if (type === 'genre') {
            data = await fetchAnimeByGenre(value, page);
        } else if (type === 'az') {
            data = await fetchAnimeByAZ(value, page);
        }
        else throw new Error('Unknown type');

        console.log('Fetched data:', data); // Check structure

        const animeList = data?.results?.data; // adjust if API is different
        if (Array.isArray(animeList) && animeList.length > 0) {
            // Use a styled list of titles instead of anime cards
            grid.classList.remove('anime-grid');
            grid.innerHTML = '<ul class="browse-results-list">' + animeList.map(anime => {
                const title = anime.title || anime.name || 'Unknown Title';
                const id = anime.id || anime.data_id;
                // The onclick navigates to the info page for that anime
                return `<li><a href="/info?id=${id}" onclick="event.preventDefault(); showInfoPage('${id}')">${title}</a></li>`;
            }).join('') + '</ul>';

            // Add pagination button if there are more results (assuming API returns more than 15 if there's a next page)
            // A more robust API would return a `hasNextPage` flag.
            if (animeList.length > 15) {
                grid.innerHTML += `<button class="cta-btn cta-primary" onclick="navigateToBrowseResults('${type}', '${value}', ${page + 1})">Next Page</button>`;
            }
        } else {
            grid.innerHTML = `<div class="no-data">No anime found for "${value || 'Unknown'}".</div>`;
        }
    } catch (err) {
        console.error(err);
        grid.innerHTML = '<div class="error">Failed to load results</div>';
    }
}


function navigateToBrowseResults(type, value, page = 1) {
    const url = `/browse/${type}/${value}?page=${page}`;
    history.pushState({ pageId: 'browse-results', type, value, page }, null, url);
    showPage('browse-results');
}


// Create anime card HTML
function createAnimeCard(anime) {
    const title = anime.title || anime.name || 'Unknown Title';
    const image = anime.poster || anime.image || 'https://via.placeholder.com/300x400?text=No+Image';
    const rank = anime.number || null;
    const id = anime.id || anime.data_id || Math.random();

    return `
        <div class="anime-card-vertical" onclick="showInfoPage('${id}')">
            ${rank ? `<div class="trending-rank"># ${rank}</div>` : ""}
            <img src="${image}" alt="${title} poster" class="anime-thumb-vertical"
                onerror="this.src='https://via.placeholder.com/300x400?text=No+Image'">
            <div class="anime-info">
                <h3 class="anime-title">${title}</h3>
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
window.navigateToBrowseResults = navigateToBrowseResults;

/**
 * Centralized routing function to handle page navigation and reloads.
 */
function handleRouting() {
    const path = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);

    if (path === '/popular') {
        showPage('popular');
    } else if (path === '/new') {
        showPage('new');
    } else if (path.startsWith('/watch') && urlParams.has('ep')) {
        showPage('watch');
    } else if (path.startsWith('/info') && urlParams.has('id')) {
        const animeId = urlParams.get('id');
        showInfoPage(animeId);
    } else if (path === '/recently-updated') {
        showPage('recently-updated');
    } else if (path === '/browse') {
        showPage('browse');
    } else if (path.startsWith('/browse/')) {
        const pathParts = path.split('/').filter(p => p);
        if (pathParts.length >= 3) {
            // This is a valid browse results page, show it.
            showPage('browse-results');
        } else {
            // If path is just /browse/ or incomplete, redirect to the main browse page.
            history.replaceState({ pageId: 'browse' }, null, '/browse');
            showPage('browse');
        }
    } else if (path === '/browse-results') {
        // This path is invalid on its own, redirect to the main browse page.
        history.replaceState({ pageId: 'browse' }, null, '/browse');
        showPage('browse');
    } else {
        showPage('home');
    }
}

// Initialize the page and set up routing
document.addEventListener('DOMContentLoaded', function() {
    handleRouting();
    
    // Set up search functionality
    const searchInput = document.querySelector('.search-input');
    searchInput.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') {
            alert(`Searching for: ${this.value}`);
            this.value = '';
        }
    });

    // Handle browser back/forward navigation
    window.addEventListener('popstate', handleRouting);
});