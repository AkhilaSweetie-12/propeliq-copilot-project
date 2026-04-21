import type { TaskStatus } from './task.model';

export interface DashboardOverview {
  projectCount: number;
  activeTaskCount: number;
  overdueTaskCount: number;
  taskBreakdown: Record<TaskStatus, number>;
  upcomingTasks: Array<{
    id: string;
    title: string;
    dueDate: string | null;
    projectName: string;
    status: TaskStatus;
  }>;
}