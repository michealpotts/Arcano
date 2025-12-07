import apiClient from '../services/apiClient';

/**
 * Build a complete image URL from a relative path
 * Uses the same base URL as the API client
 */
export function getImageUrl(relativePath) {
  if (!relativePath) return null;
  
  // If it's already a full URL, return as-is
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  
  // Get base URL from environment or default
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  
  // Remove '/api' from the end to get the server base URL
  const serverBase = baseUrl.replace('/api', '');
  
  // Combine server base with the relative path
  return `${serverBase}${relativePath}`;
}

/**
 * Fetch image as blob through API client (handles CORS + auth)
 * Returns a data URL that can be used in <img src>
 */
export async function getImageAsDataUrl(relativePath) {
  if (!relativePath) return null;
  
  try {
    // Get base URL from environment
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const serverBase = baseUrl.replace('/api', '');
    const imageUrl = `${serverBase}${relativePath}`;
    
    // Fetch image through axios (includes auth headers)
    const response = await apiClient.get(imageUrl, {
      responseType: 'blob',
      // Override baseURL since we're using full URL
      baseURL: undefined,
    });
    
    // Convert blob to data URL
    const blob = response.data;
    const reader = new FileReader();
    
    return new Promise((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error('Failed to load image:', err);
    return null;
  }
}
