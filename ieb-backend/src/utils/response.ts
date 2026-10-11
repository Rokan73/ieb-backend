import { ApiSuccessResponse, ApiErrorResponse, PaginatedResult } from '../types';

export function success<T>(
  data: T,
  message = 'Success',
  meta?: Record<string, unknown>
): ApiSuccessResponse<T> {
  return {
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  };
}

export function error(
  message: string,
  errors?: Record<string, string[]> | string[],
  code?: string
): ApiErrorResponse {
  return {
    success: false,
    message,
    ...(errors ? { errors } : {}),
    ...(code ? { code } : {}),
  };
}

export function paginated<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    items,
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

export function optionsResponse() {
  return {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Max-Age': '86400',
    },
    body: '',
  };
}
