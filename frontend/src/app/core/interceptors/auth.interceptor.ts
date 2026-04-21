import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { from, mergeMap, switchMap, throwError, type Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { SKIP_AUTH } from '../utils/auth-http-context';

const RETRY_HEADER = 'X-Auth-Retry';

function retryRequest(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
  error: HttpErrorResponse,
): Observable<HttpEvent<unknown>> {
  return from(authService.refreshAccessToken()).pipe(
    switchMap((newToken) => {
      if (!newToken) {
        return from(authService.handleAuthenticationFailure()).pipe(
          mergeMap(() => throwError(() => error)),
        );
      }

      return next(
        request.clone({
          withCredentials: true,
          setHeaders: {
            Authorization: `Bearer ${newToken}`,
            [RETRY_HEADER]: 'true',
          },
        }),
      );
    }),
  );
}

export const authInterceptor: HttpInterceptorFn = (
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  const authService = inject(AuthService);
  const skipAuth = request.context.get(SKIP_AUTH);
  const accessToken = authService.getAccessToken();

  const authorizedRequest = skipAuth || !accessToken
    ? request.clone({ withCredentials: true })
    : request.clone({
        withCredentials: true,
        setHeaders: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

  return next(authorizedRequest).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !skipAuth &&
        !request.headers.has(RETRY_HEADER)
      ) {
        return retryRequest(request, next, authService, error);
      }

      return throwError(() => error);
    }),
  );
};