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
 * Fetch all episodes for a given anime.
 * @param {string} animeId - The ID of the anime (e.g., 'one-piece-100').
 * @returns {Promise<Object>} Object containing total episodes and the episode list.
 */
export async function fetchEpisodes(animeId) {
    try {
        const response = await fetch(`${API_BASE}/episodes/${animeId}`);
        if (!response.ok) {
            throw new Error(`Episode fetch failed: ${response.status}`);
        }
        const data = await response.json();
        return data.results; // Return the entire results object
    } catch (error) {
        console.error('Error fetching episodes:', error);
        throw error;
    }
}


/**
 * Fetch anime by genre
 * @param {string} genre - Genre name
 * @param {number} page - Page number
 * @returns {Promise<Array>} Array of anime in the genre
 */
export async function fetchAnimeByGenre(genre, page = 1) {
    try {
        const response = await fetch(`${API_BASE}/genre/${genre}?page=${page}`);
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
        const response = await fetch(`${API_BASE}/recently-added`);
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

/**
 * Fetch recently updated anime
 * @returns {Promise<Object>} Recently updated anime data
 */
export async function fetchRecentlyUpdatedAnime() {
    try {
        const response = await fetch(`${API_BASE}/recently-updated`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching recently updated anime:', error);
        throw error;
    }
}

/**
 * Fetch available streaming servers for an episode.
 * @param {string} fullEpisodeId - The full ID of the episode from the episodes list (e.g., "one-piece-100?ep=2142").
 * @returns {Promise<Array>} Array of available server objects.
 */
export async function fetchServersForEpisode(fullEpisodeId) {
    try {
        const [animeId, epQuery] = fullEpisodeId.split('?');
        if (!animeId || !epQuery) {
            throw new Error("Invalid episode ID format.");
        }
        const response = await fetch(`${API_BASE}/servers/${animeId}?${epQuery}`);
        if (!response.ok) {
            throw new Error(`Server fetch failed: ${response.status}`);
        }
        const data = await response.json();
        return data.results;
    } catch (error) {
        console.error('Error fetching servers:', error);
        throw error;
    }
}

/**
 * Fetch the actual streaming data (.m3u8 link, subtitles).
 * @param {string} fullEpisodeId - The full ID of the episode (e.g., "one-piece-100?ep=2142").
 * @param {string} serverName - The name of the server (e.g., 'HD-1').
 * @param {string} type - The stream type ('sub' or 'dub').
 * @returns {Promise<Object>} Object containing the stream link and tracks.
 */
export async function fetchStreamData(fullEpisodeId, serverName, type) {
    try {
        const url = `${API_BASE}/stream?id=${fullEpisodeId}&server=${serverName}&type=${type}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Stream data fetch failed: ${response.status}`);
        }
        const data = await response.json();
        return data.results;
    } catch (error) {
        console.error('Error fetching stream data:', error);
        throw error;
    }
}

/**
 * Fetch most popular anime
 * @returns {Promise<Object>} Most popular anime data
 */
export async function fetchMostPopularAnime() {
    try {
        const response = await fetch(`${API_BASE}/most-popular`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching most popular anime:', error);
        throw error;
    }
}

/**
 * Fetch anime by A-Z list
 * @param {string} letter - The letter or '0-9' or 'other'.
 * @param {number} page - Page number
 * @returns {Promise<Array>} Array of anime for that letter.
 */
export async function fetchAnimeByAZ(letter, page = 1) {
    try {
        const response = await fetch(`${API_BASE}/az-list/${letter}?page=${page}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Error fetching anime by letter ${letter}:`, error);
        throw error;
    }
}