import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import type { DashboardOverview } from '../../core/models/dashboard.model';
import { DashboardService } from '../../core/services/dashboard.service';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { StatusPillComponent } from '../../shared/components/status-pill.component';
import { ProjectsBoardComponent } from '../projects/projects-board.component';
import type { TaskStatus } from '../../core/models/task.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, StatusPillComponent, ProjectsBoardComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);

  protected readonly overview = signal<DashboardOverview | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly breakdownEntries = computed<Array<{ key: TaskStatus; value: number }>>(() => {
    const stats = this.overview();
    if (!stats) {
      return [];
    }

    return (Object.entries(stats.taskBreakdown) as Array<[TaskStatus, number]>).map(([key, value]) => ({
      key,
      value,
    }));
  });

  ngOnInit(): void {
    void this.loadOverview();
  }

  protected async loadOverview(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      this.overview.set(await firstValueFrom(this.dashboardService.getOverview()));
    } catch (error) {
      this.errorMessage.set(extractErrorMessage(error, 'Unable to load dashboard data.'));
    } finally {
      this.isLoading.set(false);
    }
  }
}