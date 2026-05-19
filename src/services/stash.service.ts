import api from './api';
import { 
  Stash, 
  CreateStashRequest, 
  UpdateStashRequest, 
  ApiResponse 
} from '../types/stash';

export const stashService = {
  /**
   * Create a new stash
   */
  createStash: async (payload: CreateStashRequest): Promise<ApiResponse<Stash>> => {
    const response = await api.post<ApiResponse<Stash>>('/stashes', payload);
    return response.data;
  },

  /**
   * Get recent stashes
   */
  getRecentStashes: async (limit = 20, offset = 0): Promise<ApiResponse<Stash[]>> => {
    const response = await api.get<ApiResponse<Stash[]>>('/stashes', {
      params: { limit, offset },
    });
    return response.data;
  },

  /**
   * Search stashes by query
   */
  searchStashes: async (query: string): Promise<ApiResponse<Stash[]>> => {
    const response = await api.get<ApiResponse<Stash[]>>('/stashes/search', {
      params: { q: query },
    });
    return response.data;
  },

  /**
   * Get a single stash by ID
   */
  getStashById: async (id: string): Promise<ApiResponse<Stash>> => {
    const response = await api.get<ApiResponse<Stash>>(`/stashes/${id}`);
    return response.data;
  },

  /**
   * Update an existing stash
   */
  updateStash: async (id: string, payload: UpdateStashRequest): Promise<ApiResponse<Stash>> => {
    const response = await api.patch<ApiResponse<Stash>>(`/stashes/${id}`, payload);
    return response.data;
  },

  /**
   * Delete a stash (soft delete on backend)
   */
  deleteStash: async (id: string): Promise<ApiResponse<void>> => {
    const response = await api.delete<ApiResponse<void>>(`/stashes/${id}`);
    return response.data;
  },
};
