import axios from 'axios';

// Create axios instance
const envAny = (import.meta as any).env ?? {};
const resolvedApiBase = envAny.VITE_API_URL ?? envAny.VITE_API_BASE_URL ?? '/api';
const resolvedTimeout = Number(envAny.VITE_API_TIMEOUT_MS ?? 15000);

export const apiClient = axios.create({
  // Prefer explicit env (VITE_API_URL or VITE_API_BASE_URL); fallback to same-origin '/api'
  baseURL: resolvedApiBase,
  timeout: Number.isFinite(resolvedTimeout) ? resolvedTimeout : 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle common errors
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('token');
      delete apiClient.defaults.headers.common['Authorization'];
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;