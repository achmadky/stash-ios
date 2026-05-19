import axios from 'axios';
import { useAppStore } from '../store/useAppStore';

const BASE_URL = 'http://localhost:8080/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to inject Device ID and log requests
api.interceptors.request.use(
  async (config) => {
    const deviceId = useAppStore.getState().deviceId;
    if (deviceId) {
      config.headers['X-Device-ID'] = deviceId;
    }

    // Log request for debugging
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
      headers: config.headers,
      params: config.params,
      data: config.data,
    });

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for logging and generic error handling
api.interceptors.response.use(
  (response) => {
    // Log successful response
    console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
      status: response.status,
      data: response.data,
    });
    return response;
  },
  (error) => {
    const message = error.response?.data?.message || 'Something went wrong. Try again.';
    
    // Log error response
    console.error(`[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
      status: error.response?.status,
      message: message,
      data: error.response?.data,
    });

    return Promise.reject(error);
  }
);

export default api;
