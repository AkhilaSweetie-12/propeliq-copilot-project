import {
  HttpClient,
  HttpContext,
  HttpParams,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiSuccessResponse, PaginatedResult } from '../models/api-response.model';

interface RequestOptions {
  params?: Record<string, string | number | boolean | undefined | null>;
  context?: HttpContext;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  get<T>(path: string, options: RequestOptions = {}): Observable<PaginatedResult<T>> {
    return this.http
      .get<ApiSuccessResponse<T>>(`${this.apiUrl}${path}`, {
        params: this.buildParams(options.params),
        context: options.context,
        withCredentials: true,
      })
      .pipe(map((response) => ({ data: response.data, meta: response.meta })));
  }

  post<T>(path: string, body: unknown, options: RequestOptions = {}): Observable<T> {
    return this.http
      .post<ApiSuccessResponse<T>>(`${this.apiUrl}${path}`, body, {
        context: options.context,
        withCredentials: true,
      })
      .pipe(map((response) => response.data));
  }

  patch<T>(path: string, body: unknown, options: RequestOptions = {}): Observable<T> {
    return this.http
      .patch<ApiSuccessResponse<T>>(`${this.apiUrl}${path}`, body, {
        context: options.context,
        withCredentials: true,
      })
      .pipe(map((response) => response.data));
  }

  delete<T>(path: string): Observable<T> {
    return this.http
      .delete<ApiSuccessResponse<T>>(`${this.apiUrl}${path}`, {
        withCredentials: true,
      })
      .pipe(map((response) => response.data));
  }

  private buildParams(params?: RequestOptions['params']): HttpParams | undefined {
    if (!params) {
      return undefined;
    }

    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }

    return httpParams;
  }
}