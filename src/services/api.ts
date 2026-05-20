/**
 * services/api.ts
 * 
 * Purpose:
 * This file configures the base "communication layer" between the mobile app 
 * and the backend server. We use Axios because it provides powerful "Interceptors" 
 * that allow us to modify every request or response in one central place.
 * 
 * Responsibilities:
 * - Define the Backend Base URL.
 * - Inject the required X-Device-ID header into every outgoing request.
 * - Log all network traffic for easier debugging.
 * - Provide a unified error handling strategy.
 * 
 * Architecture:
 * By centralizing Axios configuration here, we avoid repeating "http://localhost:8080" 
 * and header logic in every single service file.
 */

import axios from 'axios';
import { useAppStore } from '../store/useAppStore';

// The base endpoint for our API. 
// Learning Note: In production, this would come from an environment variable (.env).
const BASE_URL = 'http://localhost:8080/api/v1';

// We create a custom Axios instance so we don't pollute the global axios object.
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request Interceptor
 * Think of this as a "pre-flight" checkpoint.
 * Every time you call api.get() or api.post(), this function runs FIRST.
 */
api.interceptors.request.use(
  async (config) => {
    // We grab the unique Device ID from our Zustand store.
    const deviceId = useAppStore.getState().deviceId;
    
    // The backend uses this ID to know WHICH user/phone is asking for data.
    if (deviceId) {
      config.headers['X-Device-ID'] = deviceId;
    }

    // Educational Logging:
    // This allows us to see exactly what the mobile app is sending to the backend 
    // without needing complex proxy tools like Charles or Fiddler.
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
      headers: config.headers,
      params: config.params,
      data: config.data,
    });

    return config;
  },
  (error) => {
    // If the request fails before it even leaves the phone (e.g. invalid config).
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor
 * This is the "post-flight" checkpoint.
 * It runs after the server sends a response but BEFORE it reaches your .then() or await.
 */
api.interceptors.response.use(
  (response) => {
    // Log successful responses for visibility.
    console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
      status: response.status,
      data: response.data,
    });
    return response;
  },
  (error) => {
    // Global Error Handling Logic:
    // If the backend returns a 4xx or 5xx error, we extract the human-readable 
    // message if available, otherwise we use a fallback.
    const message = error.response?.data?.message || 'Something went wrong. Try again.';
    
    // Log errors with red console coloring (console.error) for immediate attention.
    console.error(`[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
      status: error.response?.status,
      message: message,
      data: error.response?.data,
    });

    return Promise.reject(error);
  }
);

export default api;
