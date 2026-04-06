import { BACKEND_URL } from '../services/api';

/**
 * Resolve a profile picture URL.
 * If the path is relative (starts with /uploads), prepends the BACKEND_URL.
 * If no path is provided, returns the UI-avatars fallback.
 * @param {string} path 
 * @param {string} name 
 * @returns {string}
 */
export const getProfilePic = (path, name) => {
    if (!path) {
        return `https://ui-avatars.com/api/?background=eeafad&color=fff&name=${encodeURIComponent(name || 'User')}`;
    }
    if (path.startsWith('/uploads')) {
        return `${BACKEND_URL}${path}`;
    }
    return path; // absolute URL (Cloudinary, etc.)
};
