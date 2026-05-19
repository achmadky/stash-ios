export interface Stash {
  id: string;
  content: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateStashRequest {
  content: string;
}

export interface UpdateStashRequest {
  content: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
