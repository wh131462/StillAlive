export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  message: string | null;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}
