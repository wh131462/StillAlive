import { ApiClient } from '@still-alive/api-client';

// API base URL - update based on environment
const API_BASE_URL = __DEV__
  ? 'http://localhost:3000/api'
  : 'https://api.stillalive.app/api';

// Create and export the API client instance
export const apiClient = new ApiClient(API_BASE_URL);
