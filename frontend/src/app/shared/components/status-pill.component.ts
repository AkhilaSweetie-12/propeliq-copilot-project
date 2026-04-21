import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ProjectStatus } from '../../core/models/project.model';
import type { TaskPriority, TaskStatus } from '../../core/models/task.model';

type PillValue = ProjectStatus | TaskStatus | TaskPriority;

@Component({
  selector: 'app-status-pill',
  standalone: true,
  template: `
    <span class="status-pill" [class]="'status-pill status-pill--' + tone()">
      {{ label() }}
    </span>
  `,
  styles: [
    `
      .status-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 2rem;
        padding: 0.25rem 0.75rem;
        border-radius: 999px;
        font-family: var(--font-mono);
        font-size: 0.75rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .status-pill--default {
        background: rgba(94, 154, 214, 0.16);
        color: var(--color-ink);
      }

      .status-pill--success {
        background: rgba(76, 175, 125, 0.18);
        color: #9ce0bc;
      }

      .status-pill--warning {
        background: rgba(241, 193, 107, 0.18);
        color: #f5d28f;
      }

      .status-pill--danger {
        background: rgba(217, 104, 90, 0.2);
        color: #f4b2a8;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusPillComponent {
  readonly value = input.required<PillValue>();

  protected readonly label = computed(() => this.value().replaceAll('_', ' '));
  protected readonly tone = computed(() => {
    switch (this.value()) {
      case 'DONE':
      case 'ACTIVE':
      case 'LOW':
        return 'success';
      case 'IN_PROGRESS':
      case 'IN_REVIEW':
      case 'MEDIUM':
      case 'HIGH':
        return 'warning';
      case 'ARCHIVED':
      case 'URGENT':
        return 'danger';
      default:
        return 'default';
    }
  });
}