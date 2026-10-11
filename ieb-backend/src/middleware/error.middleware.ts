import { ZodError } from 'zod';
import { error, jsonResponse } from '../utils/response';

export function handleError(err: unknown) {
  console.error('[ERROR]', err);

  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const path = issue.path.join('.') || 'root';
      if (!fieldErrors[path]) fieldErrors[path] = [];
      fieldErrors[path].push(issue.message);
    }
    return jsonResponse(error('Validation failed', fieldErrors, 'VALIDATION_ERROR'), 400);
  }

  if (err && typeof err === 'object' && 'code' in err) {
    const prismaErr = err as { code: string; meta?: { target?: string[] } };
    if (prismaErr.code === 'P2002') {
      const fields = prismaErr.meta?.target?.join(', ') || 'field';
      return jsonResponse(
        error(`Duplicate value for: ${fields}`, undefined, 'DUPLICATE'),
        409
      );
    }
    if (prismaErr.code === 'P2025') {
      return jsonResponse(error('Record not found', undefined, 'NOT_FOUND'), 404);
    }
  }

  if (err instanceof Error) {
    if (err.message === 'NOT_FOUND') {
      return jsonResponse(error('Resource not found', undefined, 'NOT_FOUND'), 404);
    }
    if (err.message === 'FORBIDDEN') {
      return jsonResponse(error('Forbidden', undefined, 'FORBIDDEN'), 403);
    }
    if (err.message === 'UNAUTHORIZED') {
      return jsonResponse(error('Unauthorized', undefined, 'UNAUTHORIZED'), 401);
    }
    // Do not leak internal details in production
    const message =
      process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
    return jsonResponse(error(message, undefined, 'INTERNAL_ERROR'), 500);
  }

  return jsonResponse(error('Internal server error', undefined, 'INTERNAL_ERROR'), 500);
}
