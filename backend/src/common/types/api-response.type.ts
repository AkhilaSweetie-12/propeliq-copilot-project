export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
    traceId: string;
    timestamp: string;
  };
}

export interface ServiceResponse<T> {
  data: T;
  meta?: PaginationMeta;
}