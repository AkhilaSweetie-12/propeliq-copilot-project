import { HttpBackend, HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { AuthResponse, AuthUser, LoginPayload, RegisterPayload } from '../models/auth.model';
import { ApiService } from './api.service';
import { SKIP_AUTH } from '../utils/auth-http-context';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiService = inject(ApiService);
  private readonly router = inject(Router);
  private readonly rawHttp = new HttpClient(inject(HttpBackend));
  private readonly apiUrl = environment.apiUrl;

  private readonly accessTokenState = signal<string | null>(null);
  private readonly userState = signal<AuthUser | null>(null);
  private readonly initializedState = signal(false);
  private refreshRequest: Promise<string | null> | null = null;

  readonly user = this.userState.asReadonly();
  readonly initialized = this.initializedState.asReadonly();
  readonly isAuthenticated = computed(() => Boolean(this.accessTokenState() && this.userState()));

  async initialize(): Promise<void> {
    if (this.initializedState()) {
      return;
    }

    try {
      await this.refreshAccessToken();
    } finally {
      this.initializedState.set(true);
    }
  }

  async login(payload: LoginPayload): Promise<void> {
    const response = await firstValueFrom(
      this.apiService.post<AuthResponse>('/auth/login', payload, {
        context: new HttpContext().set(SKIP_AUTH, true),
      }),
    );
    this.storeSession(response);
  }

  async register(payload: RegisterPayload): Promise<void> {
    const response = await firstValueFrom(
      this.apiService.post<AuthResponse>('/auth/register', payload, {
        context: new HttpContext().set(SKIP_AUTH, true),
      }),
    );
    this.storeSession(response);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.apiService.post<{ loggedOut: boolean }>('/auth/logout', {}));
    } finally {
      this.clearSession();
      await this.router.navigate(['/login']);
    }
  }

  async refreshAccessToken(): Promise<string | null> {
    this.refreshRequest ??= firstValueFrom(
      this.rawHttp.post<{ success: true; data: AuthResponse }>(`${this.apiUrl}/auth/refresh`, {}, {
        withCredentials: true,
      }),
    )
      .then((response) => {
        this.storeSession(response.data);
        return response.data.accessToken;
      })
      .catch(() => {
        this.clearSession();
        return null;
      })
      .finally(() => {
        this.refreshRequest = null;
      });

    return this.refreshRequest;
  }

  getAccessToken(): string | null {
    return this.accessTokenState();
  }

  async handleAuthenticationFailure(): Promise<void> {
    this.clearSession();
    await this.router.navigate(['/login']);
  }

  private storeSession(response: AuthResponse): void {
    this.accessTokenState.set(response.accessToken);
    this.userState.set(response.user);
  }

  private clearSession(): void {
    this.accessTokenState.set(null);
    this.userState.set(null);
  }
}