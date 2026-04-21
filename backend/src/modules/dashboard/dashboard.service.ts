import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { RedisService } from '../../common/services/redis.service';
import type { ServiceResponse } from '../../common/types/api-response.type';
import { PrismaService } from '../../prisma/prisma.service';

interface DashboardOverview {
  projectCount: number;
  activeTaskCount: number;
  overdueTaskCount: number;
  taskBreakdown: Record<TaskStatus, number>;
  upcomingTasks: Array<{
    id: string;
    title: string;
    dueDate: Date | null;
    projectName: string;
    status: TaskStatus;
  }>;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async overview(userId: string): Promise<ServiceResponse<DashboardOverview>> {
    const cacheKey = `dashboard:${userId}`;
    const cached = await this.redisService.get<DashboardOverview>(cacheKey);
    if (cached) {
      return { data: cached };
    }

    const now = new Date();
    const [projectCount, activeTaskCount, overdueTaskCount, groupedTasks, upcomingTasks] =
      await Promise.all([
        this.prismaService.project.count({
          where: {
            deletedAt: null,
            members: { some: { userId } },
          },
        }),
        this.prismaService.task.count({
          where: {
            deletedAt: null,
            project: { members: { some: { userId } } },
            status: { not: TaskStatus.DONE },
          },
        }),
        this.prismaService.task.count({
          where: {
            deletedAt: null,
            project: { members: { some: { userId } } },
            dueDate: { lt: now },
            status: { not: TaskStatus.DONE },
          },
        }),
        this.prismaService.task.groupBy({
          by: ['status'],
          where: {
            deletedAt: null,
            project: { members: { some: { userId } } },
          },
          _count: { status: true },
        }),
        this.prismaService.task.findMany({
          where: {
            deletedAt: null,
            project: { members: { some: { userId } } },
            dueDate: { not: null },
          },
          orderBy: { dueDate: 'asc' },
          take: 6,
          include: {
            project: {
              select: { name: true },
            },
          },
        }),
      ]);

    const taskBreakdown: Record<TaskStatus, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
    };
    for (const item of groupedTasks) {
      taskBreakdown[item.status] = item._count.status;
    }

    const overview: DashboardOverview = {
      projectCount,
      activeTaskCount,
      overdueTaskCount,
      taskBreakdown,
      upcomingTasks: upcomingTasks.map((task) => ({
        id: task.id,
        title: task.title,
        dueDate: task.dueDate,
        projectName: task.project.name,
        status: task.status,
      })),
    };

    await this.redisService.set(cacheKey, overview, 60);
    return { data: overview };
  }
}