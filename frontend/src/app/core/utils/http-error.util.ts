import { HttpErrorResponse } from '@angular/common/http';

export function extractErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  const message = error.error?.error?.message;
  return typeof message === 'string' && message.length > 0 ? message : fallback;
}