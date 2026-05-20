/**
 * services/stash.service.ts
 * 
 * Purpose:
 * This is the "Feature Service" for Stashes. 
 * It contains the specific business logic for interacting with Stash-related endpoints.
 * 
 * Responsibilities:
 * - Map frontend function calls (like createStash) to specific HTTP methods and URLs.
 * - Abstract away the details of request parameters and response types.
 * 
 * Architecture:
 * We separate "Stash Service" from the "Base API" (api.ts) so that if we add 
 * other features later (like "User Service" or "Settings Service"), the code 
 * remains modular and easy to navigate.
 */

import api from './api';
import { 
  Stash, 
  CreateStashRequest, 
  UpdateStashRequest, 
  ApiResponse 
} from '../types/stash';

export const stashService = {
  /**
   * createStash
   * Sends a new item description to the backend to be stored.
   */
  createStash: async (payload: CreateStashRequest): Promise<ApiResponse<Stash>> => {
    const response = await api.post<ApiResponse<Stash>>('/stashes', payload);
    return response.data;
  },

  /**
   * getRecentStashes
   * Retrieves a list of items recently added by this device.
   * We use "limit" and "offset" for future-proofing pagination.
   */
  getRecentStashes: async (limit = 20, offset = 0): Promise<ApiResponse<Stash[]>> => {
    const response = await api.get<ApiResponse<Stash[]>>('/stashes', {
      params: { limit, offset },
    });
    return response.data;
  },

  /**
   * searchStashes
   * Performs a partial-match search on the backend across all stashes for this device.
   */
  searchStashes: async (query: string): Promise<ApiResponse<Stash[]>> => {
    const response = await api.get<ApiResponse<Stash[]>>('/stashes/search', {
      params: { q: query },
    });
    return response.data;
  },

  /**
   * getStashById
   * Fetches the full details of a single stash. 
   * Useful for showing a detail view or pre-filling an edit form.
   */
  getStashById: async (id: string): Promise<ApiResponse<Stash>> => {
    const response = await api.get<ApiResponse<Stash>>(`/stashes/${id}`);
    return response.data;
  },

  /**
   * updateStash
   * Sends corrected or updated content for an existing stash.
   * We use PATCH instead of PUT because we only want to update specific fields.
   */
  updateStash: async (id: string, payload: UpdateStashRequest): Promise<ApiResponse<Stash>> => {
    const response = await api.patch<ApiResponse<Stash>>(`/stashes/${id}`, payload);
    return response.data;
  },

  /**
   * deleteStash
   * Removes a stash. 
   * Note: Our backend implements "Soft Delete," meaning it marks it as deleted 
   * in the database but doesn't actually erase the row immediately.
   */
  deleteStash: async (id: string): Promise<ApiResponse<void>> => {
    const response = await api.delete<ApiResponse<void>>(`/stashes/${id}`);
    return response.data;
  },
};
