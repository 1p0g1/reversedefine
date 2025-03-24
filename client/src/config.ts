// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Gets the API URL by combining the base URL with the provided path
 * @param path - The API path (should start with '/')
 * @returns The complete API URL
 */
export const getApiUrl = (path: string): string => {
  // Remove any double slashes except for http(s)://
  return `${API_BASE_URL}${path}`.replace(/([^:]\/)\/+/g, '$1');
};

/**
 * Builds a complete API URL by combining the base URL with the provided endpoint
 * @param endpoint - The API endpoint (should start with '/')
 * @returns The complete API URL
 */
export const buildApiUrl = (endpoint: string): string => {
  // Remove any double slashes except for http(s)://
  return `${API_BASE_URL}${endpoint}`.replace(/([^:]\/)\/+/g, '$1');
}; 