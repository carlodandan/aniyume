// Mainly for API request and Proxy-ing

export const PROXY_URL = 'https://theanimedbproxy.vercel.app/';
export const API_BASE = 'https://theanimedb-api.vercel.app/api';

// API Functions for fetching anime data

/**
 * Fetch home page data including trending, schedules, and featured content
 * @returns {Promise<Object>} Home page data
 */
export async function fetchHomeData() {
    try {
        const response = await fetch(`${API_BASE}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching home data:', error);
        throw error;
    }
}

/**
 * Fetch detailed information about a specific anime
 * @param {string|number} id - Anime ID
 * @returns {Promise<Object>} Detailed anime information
 */
export async function fetchAnimeDetails(id) {
    try {
        const response = await fetch(`${API_BASE}/info?id=${id}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching anime details:', error);
        throw error;
    }
}

/**
 * Fetch anime by genre
 * @param {string} genre - Genre name
 * @returns {Promise<Array>} Array of anime in the genre
 */
export async function fetchAnimeByGenre(genre) {
    try {
        const response = await fetch(`${API_BASE}/genre/${encodeURIComponent(genre)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching anime by genre:', error);
        throw error;
    }
}

/**
 * Fetch popular anime
 * @param {number} page - Page number (optional, defaults to 1)
 * @returns {Promise<Array>} Array of popular anime
 */
export async function fetchPopularAnime(page = 1) {
    try {
        const response = await fetch(`${API_BASE}/popular?page=${page}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching popular anime:', error);
        throw error;
    }
}

/**
 * Fetch recently added anime
 * @returns {Promise<Array>} Array of recently added anime
 */
export async function fetchRecentAnime() {
    try {
        const response = await fetch(`${API_BASE}/recent`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching recent anime:', error);
        throw error;
    }
}
