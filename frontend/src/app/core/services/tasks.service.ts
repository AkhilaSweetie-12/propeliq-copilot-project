import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import type { CreateTaskPayload, Task, TaskStatus } from '../models/task.model';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class TasksService {
  private readonly apiService = inject(ApiService);

  listTasks(projectId: string): Observable<Task[]> {
    return this.apiService.get<Task[]>('/tasks', {
      params: {
        page: 1,
        limit: 100,
        projectId,
      },
    }).pipe(map((response) => response.data));
  }

  createTask(payload: CreateTaskPayload): Observable<Task> {
    return this.apiService.post<Task>('/tasks', payload);
  }

  updateTaskStatus(taskId: string, status: TaskStatus): Observable<Task> {
    return this.apiService.patch<Task>(`/tasks/${taskId}`, { status });
  }
}