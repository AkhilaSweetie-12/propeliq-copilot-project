import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import type { Project } from '../../core/models/project.model';
import type { CreateTaskPayload, Task, TaskPriority, TaskStatus } from '../../core/models/task.model';
import { TASK_STATUS_ORDER } from '../../core/models/task.model';
import { ProjectsService } from '../../core/services/projects.service';
import { TasksService } from '../../core/services/tasks.service';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { StatusPillComponent } from '../../shared/components/status-pill.component';

@Component({
  selector: 'app-projects-board',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, StatusPillComponent],
  templateUrl: './projects-board.component.html',
  styleUrl: './projects-board.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsBoardComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly projectsService = inject(ProjectsService);
  private readonly tasksService = inject(TasksService);

  readonly changed = output<void>();

  protected readonly isLoadingProjects = signal(true);
  protected readonly isLoadingTasks = signal(false);
  protected readonly isCreatingProject = signal(false);
  protected readonly isCreatingTask = signal(false);
  protected readonly updatingTaskId = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly projects = signal<Project[]>([]);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly selectedProjectId = signal<string | null>(null);
  protected readonly projectForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(500)]],
  });
  protected readonly taskForm = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    description: ['', [Validators.maxLength(1000)]],
    priority: ['MEDIUM' as TaskPriority, [Validators.required]],
    dueDate: [''],
  });
  protected readonly taskColumns = computed(() =>
    TASK_STATUS_ORDER.map((status) => ({
      status,
      items: this.tasks().filter((task) => task.status === status),
    })),
  );
  protected readonly selectedProject = computed(() =>
    this.projects().find((project) => project.id === this.selectedProjectId()) ?? null,
  );

  constructor() {
    effect(() => {
      const selectedProjectId = this.selectedProjectId();
      if (selectedProjectId) {
        void this.loadTasks(selectedProjectId);
      }
    });
  }

  ngOnInit(): void {
    void this.loadProjects();
  }

  protected selectProject(projectId: string): void {
    this.selectedProjectId.set(projectId);
  }

  protected async createProject(): Promise<void> {
    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.isCreatingProject.set(true);

    try {
      const project = await firstValueFrom(
        this.projectsService.createProject(this.projectForm.getRawValue()),
      );
      this.projects.update((currentProjects) => [project, ...currentProjects]);
      this.selectedProjectId.set(project.id);
      this.projectForm.reset({ name: '', description: '' });
      this.changed.emit();
    } catch (error) {
      this.errorMessage.set(extractErrorMessage(error, 'Unable to create project.'));
    } finally {
      this.isCreatingProject.set(false);
    }
  }

  protected async createTask(): Promise<void> {
    if (this.taskForm.invalid || !this.selectedProjectId()) {
      this.taskForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.isCreatingTask.set(true);

    try {
      const selectedProjectId = this.selectedProjectId();
      if (!selectedProjectId) {
        return;
      }

      const payload: CreateTaskPayload = {
        projectId: selectedProjectId,
        title: this.taskForm.controls.title.getRawValue(),
        description: this.taskForm.controls.description.getRawValue() || undefined,
        priority: this.taskForm.controls.priority.getRawValue(),
        dueDate: this.taskForm.controls.dueDate.getRawValue() || null,
      };

      const task = await firstValueFrom(this.tasksService.createTask(payload));
      this.tasks.update((currentTasks) => [...currentTasks, task]);
      this.taskForm.reset({ title: '', description: '', priority: 'MEDIUM', dueDate: '' });
      this.changed.emit();
    } catch (error) {
      this.errorMessage.set(extractErrorMessage(error, 'Unable to create task.'));
    } finally {
      this.isCreatingTask.set(false);
    }
  }

  protected async updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
    this.updatingTaskId.set(taskId);
    this.errorMessage.set(null);

    try {
      const updatedTask = await firstValueFrom(this.tasksService.updateTaskStatus(taskId, status));
      this.tasks.update((currentTasks) =>
        currentTasks.map((task) => (task.id === updatedTask.id ? updatedTask : task)),
      );
      this.changed.emit();
    } catch (error) {
      this.errorMessage.set(extractErrorMessage(error, 'Unable to update task status.'));
    } finally {
      this.updatingTaskId.set(null);
    }
  }

  protected readStatus(event: Event): TaskStatus {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
      return 'TODO';
    }

    return target.value as TaskStatus;
  }

  protected trackTask(_: number, task: Task): string {
    return task.id;
  }

  private async loadProjects(): Promise<void> {
    this.isLoadingProjects.set(true);
    this.errorMessage.set(null);

    try {
      const result = await firstValueFrom(this.projectsService.listProjects());
      this.projects.set(result.items);
      if (!this.selectedProjectId() && result.items.length > 0) {
        this.selectedProjectId.set(result.items[0].id);
      }
    } catch (error) {
      this.errorMessage.set(extractErrorMessage(error, 'Unable to load projects.'));
    } finally {
      this.isLoadingProjects.set(false);
    }
  }

  private async loadTasks(projectId: string): Promise<void> {
    this.isLoadingTasks.set(true);

    try {
      this.tasks.set(await firstValueFrom(this.tasksService.listTasks(projectId)));
    } catch (error) {
      this.errorMessage.set(extractErrorMessage(error, 'Unable to load tasks.'));
    } finally {
      this.isLoadingTasks.set(false);
    }
  }
}