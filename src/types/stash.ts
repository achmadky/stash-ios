/**
 * types/stash.ts
 * 
 * Purpose:
 * This file defines the "Contract" between the frontend and the backend.
 * By using TypeScript interfaces, we ensure that both the UI and the API 
 * logic agree on what a "Stash" object looks like.
 * 
 * Responsibilities:
 * - Define the core Stash data structure.
 * - Define Request (DTO) and Response shapes for API calls.
 * 
 * Learning Note:
 * DTO stands for "Data Transfer Object." 
 * We use separate interfaces for "Create" and "Update" requests because 
 * the fields required to make a stash (just content) are different from 
 * the fields we receive from the backend (id, timestamps, etc.).
 */

/**
 * The primary data model for an item stored in the app.
 */
export interface Stash {
  id: string;          // Unique identifier (UUID)
  content: string;     // The human-readable text (e.g., "passport drawer")
  created_at: string;  // ISO timestamp of when it was first made
  updated_at?: string; // Optional ISO timestamp of the last edit
}

/**
 * Payload sent to POST /stashes
 */
export interface CreateStashRequest {
  content: string;
}

/**
 * Payload sent to PATCH /stashes/:id
 */
export interface UpdateStashRequest {
  content: string;
}

/**
 * Standard Envelope for all API responses.
 * The backend always wraps data in this structure for predictability.
 */
export interface ApiResponse<T> {
  success: boolean;    // Indicates if the operation was technically successful
  data: T;             // The actual payload (could be a single Stash or an array)
  message?: string;    // Human-readable message, usually for errors
}
