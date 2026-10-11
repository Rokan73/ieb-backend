export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  permissions: string[];
}

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: Record<string, string[]> | string[];
  code?: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface ListQuery {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  from?: string;
  to?: string;
  [key: string]: string | undefined;
}

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  IEB_ADMIN: 'ieb_admin',
  MEMBERSHIP_OFFICER: 'membership_officer',
  COMMITTEE_OFFICER: 'committee_officer',
  EVENT_OFFICER: 'event_officer',
  REGISTRATION_OFFICER: 'registration_officer',
  MEMBER: 'member',
  PUBLIC: 'public',
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];
