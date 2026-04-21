import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import type { CreateProjectPayload, Project } from '../models/project.model';
import type { PaginationMeta } from '../models/api-response.model';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly apiService = inject(ApiService);

  listProjects(search = ''): Observable<{ items: Project[]; meta?: PaginationMeta }> {
    return this.apiService.get<Project[]>('/projects', { params: { search, page: 1, limit: 50 } }).pipe(
      map((response) => ({ items: response.data, meta: response.meta })),
    );
  }

  createProject(payload: CreateProjectPayload): Observable<Project> {
    return this.apiService.post<Project>('/projects', payload);
  }
}