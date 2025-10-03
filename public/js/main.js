// Import API functions
import { fetchHomeData, fetchAnimeDetails, fetchRecentlyUpdatedAnime, fetchEpisodes, fetchMostPopularAnime, fetchRecentAnime, fetchAnimeByGenre, fetchAnimeByAZ, fetchMostFavoriteAnime, fetchSearchResults, fetchSearchSuggestions, fetchMovies } from './api.js';
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
    if (pageId !== 'watch' && pageId !== 'browse-results' && pageId !== 'search-results' && pageId !== 'info') { // URLs handled by their own navigation functions
        const path = pageId === 'home' ? '/' : `/${pageId}`;
        // Avoid pushing state if it's the same as the current one
        if (window.location.pathname !== path || window.location.search) {
            history.pushState({ pageId: pageId }, null, path);
        }
    }

    // Run page-specific functions
    if (pageId === 'browse') {
        initBrowsePage();
    } else if (pageId === 'watch') {
        initPlayer();
    } else if (pageId === 'home') {
        loadTrendingAnime();
        loadContinueWatching();
    } else if (pageId === 'info') {
        initInfoPage();
    } else if (pageId === 'popular') { // Add this case
        loadMostPopularAnime();
    } else if (pageId === 'recent') {
        loadRecentPage();
    } else if (pageId === 'favorites') {
        loadFavoritesPage();
    } else if (pageId === 'recently-updated') {
        loadRecentlyUpdatedAnime();
    } else if (pageId === 'browse-results') {
        // This needs to be called after the page is shown
        loadBrowseResultsPage();
    } else if (pageId === 'search-results') {
        loadSearchResultsPage();
    } else if (pageId === 'movie') {
        loadMoviePage();
    } else if (pageId === 'about') {
        // No specific data loading needed for static about page
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

async function loadRecentPage() {
    loadRecentlyAdded();
    loadRecentlyUpdated();
}

async function loadRecentlyAdded() {
    const grid = document.querySelector('.recently-added-grid');
    if (!grid) return;

    try {
        grid.innerHTML = '<div class="loading">Loading recently added anime...</div>';
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

// Load recently updated anime from API
async function loadRecentlyUpdated() {
    const grid = document.querySelector('#recent-page .recently-updated-grid');
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
        // Corrected line to access the nested data array
        const data = await fetchMostPopularAnime();
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

// Load favorites anime from API
async function loadFavoritesPage() {
    const grid = document.querySelector('#favorites-page .anime-grid');
    if (!grid) return;

    try {
        grid.innerHTML = '<div class="loading">Loading your favorite anime...</div>';
        const data = await fetchMostFavoriteAnime();
        const animeList = data.results.data;

        if (animeList && animeList.length > 0) {
            grid.innerHTML = animeList.map(anime => createAnimeCard(anime)).join('');
        } else {
            grid.innerHTML = '<div class="no-data">No favorite anime found.</div>';
        }
    } catch (error) {
        console.error('Error loading favorite anime:', error);
        grid.innerHTML = '<div class="error">Failed to load favorite anime. Please try again later.</div>';
    }
}

// Load movies from API
async function loadMoviePage() {
    const grid = document.querySelector('#movie-page .anime-grid');
    if (!grid) return;

    try {
        grid.innerHTML = '<div class="loading">Loading movies...</div>';
        const data = await fetchMovies();
        const animeList = data.results.data;

        if (animeList && animeList.length > 0) {
            grid.innerHTML = animeList.map(anime => createAnimeCard(anime)).join('');
        } else {
            grid.innerHTML = '<div class="no-data">No movies available</div>';
        }
    } catch (error) {
        console.error('Error loading movies:', error);
        grid.innerHTML = '<div class="error">Failed to load movies. Please try again later.</div>';
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
        } else throw new Error('Unknown type');

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

function navigateToSearch(query) {
    if (!query || query.trim() === '') return;
    const trimmedQuery = query.trim();
    const url = `/search?keyword=${encodeURIComponent(trimmedQuery)}`;
    history.pushState({ pageId: 'search-results', query: trimmedQuery }, null, url);
    showPage('search-results');
}

async function loadSearchResultsPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('keyword');
    const page = parseInt(urlParams.get('page') || '1', 10);

    const grid = document.getElementById('search-results-grid');
    const titleEl = document.getElementById('search-results-title');

    if (!grid || !titleEl) return;

    if (!query) {
        titleEl.textContent = 'Please enter a search term.';
        grid.innerHTML = '';
        return;
    }

    grid.innerHTML = '<div class="loading">Searching...</div>';
    titleEl.innerHTML = `<i class="fas fa-search"></i> Results for: "${query}"`;

    try {
        const data = await fetchSearchResults(query, page);
        const animeList = data?.results?.data;

        if (Array.isArray(animeList) && animeList.length > 0) {
            grid.innerHTML = animeList.map(anime => createAnimeCard(anime)).join('');
        } else {
            grid.innerHTML = `<div class="no-data">No results found for "${query}".</div>`;
        }
    } catch (err) {
        console.error(err);
        grid.innerHTML = '<div class="error">Failed to load search results.</div>';
    }
}

// --- Search Suggestions Logic ---

function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

function renderSearchSuggestions(suggestions) {
    const suggestionsContainer = document.querySelector('.search-suggestions');
    if (!suggestionsContainer) return;

    if (!suggestions || suggestions.length === 0) {
        suggestionsContainer.style.display = 'none';
        return;
    }

    const list = suggestions.map(anime => `
        <li>
            <a href="/info?id=${anime.id}" onclick="event.preventDefault(); handleSuggestionClick('${anime.id}')">
                <img src="${anime.poster}" alt="${anime.title}" class="suggestion-poster">
                <span class="suggestion-title">${anime.title}</span>
            </a>
        </li>
    `).join('');

    suggestionsContainer.innerHTML = `<ul>${list}</ul>`;
    suggestionsContainer.style.display = 'block';
}




// Create anime card HTML
function createAnimeCard(anime) {
    const title = anime.title || anime.name || 'Unknown Title';
    const image = anime.poster || anime.image;
    const rank = anime.number || null;
    const id = anime.id || anime.data_id || Math.random();
    const rating = anime.score || anime.rating || null;
    return `
        <a href="/info?id=${id}" onclick="event.preventDefault(); showInfoPage('${id}')" class="anime-card-vertical">
            <div class="anime-card-img-wrapper skeleton">
                ${image ? `<img src="${image}" alt="${title}" loading="lazy" class="anime-card-img" onload="this.parentNode.classList.remove('skeleton')" onerror="this.src='/img/placeholder.jpg'">` : ''}
                <div class="anime-card-overlay">
                    <div class="anime-info-onhover">
                        <h3 class="anime-title">${title}</h3>
                        ${rating ? `<div class="anime-meta"><span class="anime-rating"><i class="fas fa-star"></i> ${rating}</span></div>` : ''}
                    </div>
                </div>
            </div>
            <div class="anime-info">
                <h3 class="anime-title">${title}</h3>
            </div>
            ${rank ? `<div class="trending-rank">#${rank}</div>` : ''}
        </a>
    `;
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

        // Now we can safely get the latest episode
        const latestEpisode = episodes[episodes.length - 1];
        const fullEpisodeId = latestEpisode.id;

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

    poster.innerHTML = ''; // Clear previous image
    poster.alt = '';
    title.textContent = 'Loading...';
    meta.innerHTML = '';
    description.textContent = '';
    tags.innerHTML = '';

    poster.classList.add('skeleton');

    try {
        const apiResponse = await fetchAnimeDetails(animeId);
        const details = apiResponse.results?.data;

        if (!details) {
            title.textContent = 'Anime Not Found';
            description.textContent = 'The details for this anime could not be loaded.';
            return;
        }

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

        // Correctly handle poster image loading
        if (details.poster) {
            const img = document.createElement('img');
            img.src = details.poster;
            img.alt = `${details.title} poster`;
            img.className = 'poster-img'; // Add a class for specific styling
            img.onload = () => poster.classList.remove('skeleton'); // Remove skeleton on successful load
            img.onerror = () => this.style.display = 'none'; // Hide broken image, keep skeleton
            poster.appendChild(img);
        }
    } catch (error) {
        console.error('Error loading anime info:', error);
        title.textContent = 'Error loading anime info';
        description.textContent = 'Please try again later.';
    }
}

function goBack() {
    history.back();
}

function showInfoPage(animeId) {
    if (!animeId) return;
    currentInfoPageAnimeId = animeId;
    const newPath = `/anime/info?id=${animeId}`;
    // Avoid pushing state if we are already on the correct URL (e.g., on page reload)
    if (window.location.pathname + window.location.search !== newPath) {
        history.pushState({ pageId: 'info', animeId: animeId }, '', newPath);
    }
    showPage('info');
    loadInfoPage(animeId);
}

function handleSuggestionClick(animeId) {
    const suggestionsContainer = document.querySelector('.search-suggestions');
    const searchInput = document.querySelector('.search-input');

    if (suggestionsContainer) suggestionsContainer.style.display = 'none';
    if (searchInput) searchInput.value = '';

    showInfoPage(animeId);
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
window.navigateToSearch = navigateToSearch;
window.handleSuggestionClick = handleSuggestionClick;
window.resumeAnime = resumeAnime;

/**
 * Centralized routing function to handle page navigation and reloads.
 */
function handleRouting() {
    const path = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);

    if (path === '/popular') {
        showPage('popular');
    } else if (path === '/recent') {
        showPage('recent');
    } else if (path === '/favorites') {
        showPage('favorites');
    } else if (path === '/movie') {
        showPage('movie');
    } else if (path === '/about') {
        showPage('about');
    } else if (path.startsWith('/search') && urlParams.has('keyword')) {
        showPage('search-results');
    } else if (path.startsWith('/anime/info') && urlParams.has('id')) {
        const animeId = urlParams.get('id');
        showInfoPage(animeId);
    } else if (path.startsWith('/watch') && urlParams.has('ep')) {
        showPage('watch');
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

async function loadContinueWatching() {
    const section = document.getElementById('continue-watching-section');
    const grid = section.querySelector('.continue-watching-grid');

    try {
        const history = JSON.parse(localStorage.getItem('aniyumeWatchHistory')) || {};
        const historyItems = Object.values(history).sort((a, b) => new Date(b.watchedAt) - new Date(a.watchedAt));

        if (historyItems.length > 0) {
            grid.innerHTML = historyItems.map(item => createContinueWatchingCard(item)).join('');
            section.style.display = 'block';
        } else {
            section.style.display = 'none';
        }
    } catch (e) {
        console.error("Failed to load watch history:", e);
        section.style.display = 'none';
    }
}

function createContinueWatchingCard(item) {
    return `
        <a href="/watch?ep=${item.episodeId}&t=${item.currentTime}" onclick="event.preventDefault(); resumeAnime('${item.episodeId}', ${item.currentTime})" class="anime-card-vertical">
            <div class="anime-card-img-wrapper skeleton">
                <img src="${item.poster}" alt="${item.title}" loading="lazy" class="anime-card-img" onload="this.parentNode.classList.remove('skeleton')">
                <div class="anime-card-overlay">
                    <div class="anime-info-onhover">
                        <i class="fas fa-play"></i>
                        <p>Resume</p>
                    </div>
                </div>
            </div>
            <div class="anime-info">
                <h3 class="anime-title">${item.title}</h3>
            </div>
            <div class="progress-bar">
                <div class="progress" style="width:${(item.currentTime / item.duration) * 100}%"></div>
            </div>
        </a>
    `;
}

function resumeAnime(episodeId, startTime) {
    const url = `/watch?ep=${encodeURIComponent(episodeId)}&t=${startTime}`;
    history.pushState({ pageId: 'watch', episodeId: episodeId, startTime: startTime }, null, url);
    showPage('watch');
}


// Initialize the page and set up routing
document.addEventListener('DOMContentLoaded', function() {
    handleRouting();

    // Set up search functionality
    const searchInput = document.querySelector('.search-input');
    const suggestionsContainer = document.querySelector('.search-suggestions');

    const handleSearchInput = debounce(async (event) => {
        const query = event.target.value.trim();
        if (query.length < 2) { // Don't search for less than 2 characters
            suggestionsContainer.style.display = 'none';
            return;
        }
    
        try {
            const data = await fetchSearchSuggestions(query);
            renderSearchSuggestions(data?.results);
        } catch (error) {
            console.error('Failed to fetch search suggestions:', error);
            suggestionsContainer.style.display = 'none';
        }
    }, 300);

    searchInput.addEventListener('input', (event) => handleSearchInput(event));

    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            suggestionsContainer.style.display = 'none';
            navigateToSearch(e.target.value);
            e.target.value = '';
        }
    });

    document.addEventListener('click', (event) => {
        if (!searchInput.contains(event.target) && !suggestionsContainer.contains(event.target)) {
            suggestionsContainer.style.display = 'none';
        }
    });

    // Handle browser back/forward navigation
    window.addEventListener('popstate', handleRouting);
});