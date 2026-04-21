import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import type { DashboardOverview } from '../models/dashboard.model';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly apiService = inject(ApiService);

  getOverview(): Observable<DashboardOverview> {
    return this.apiService.get<DashboardOverview>('/dashboard/overview').pipe(
      map((response) => response.data),
    );
  }
}