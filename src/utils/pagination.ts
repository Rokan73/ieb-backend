import { PaginationParams, ListQuery } from '../types';

export function parsePagination(query: ListQuery): PaginationParams {
  const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function parseSort(
  query: ListQuery,
  allowedFields: string[],
  defaultField = 'createdAt',
  defaultOrder: 'asc' | 'desc' = 'desc'
): Record<string, 'asc' | 'desc'> {
  const sortField = query.sort && allowedFields.includes(query.sort) ? query.sort : defaultField;
  const order = query.order === 'asc' || query.order === 'desc' ? query.order : defaultOrder;
  return { [sortField]: order };
}
