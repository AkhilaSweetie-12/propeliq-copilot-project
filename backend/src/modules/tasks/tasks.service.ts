import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectRole, TaskStatus, type TaskPriority } from '@prisma/client';
import { RedisService } from '../../common/services/redis.service';
import type { ServiceResponse } from '../../common/types/api-response.type';
import type { AuthenticatedUser } from '../../common/types/request-with-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksDto } from './dto/list-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

interface TaskSummary {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  assigneeId: string | null;
  reporterId: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async create(
    dto: CreateTaskDto,
    user: AuthenticatedUser,
  ): Promise<ServiceResponse<TaskSummary>> {
    const membership = await this.requireProjectAccess(dto.projectId, user.userId, true);
    if (membership.role === ProjectRole.VIEWER) {
      throw new ForbiddenException('Viewers cannot create tasks.');
    }

    const position = await this.prismaService.task.count({
      where: { projectId: dto.projectId, deletedAt: null },
    });

    const task = await this.prismaService.task.create({
      data: {
        projectId: dto.projectId,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        dueDate: dto.dueDate,
        assigneeId: dto.assigneeId,
        reporterId: user.userId,
        position,
      },
    });

    await this.invalidateProjectCache(dto.projectId);
    return { data: this.mapTask(task) };
  }

  async findAll(
    query: ListTasksDto,
    user: AuthenticatedUser,
  ): Promise<ServiceResponse<TaskSummary[]>> {
    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(query.projectId
        ? { projectId: query.projectId }
        : {
            project: {
              members: {
                some: { userId: user.userId },
              },
            },
          }),
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { description: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    if (query.projectId) {
      await this.requireProjectAccess(query.projectId, user.userId, false);
    }

    const [total, tasks] = await Promise.all([
      this.prismaService.task.count({ where }),
      this.prismaService.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ status: 'asc' }, { position: 'asc' }, { updatedAt: 'desc' }],
      }),
    ]);

    return {
      data: tasks.map((task) => this.mapTask(task)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(taskId: string, user: AuthenticatedUser): Promise<ServiceResponse<TaskSummary>> {
    const task = await this.requireTaskAccess(taskId, user.userId);
    return { data: this.mapTask(task) };
  }

  async update(
    taskId: string,
    dto: UpdateTaskDto,
    user: AuthenticatedUser,
  ): Promise<ServiceResponse<TaskSummary>> {
    const task = await this.requireTaskAccess(taskId, user.userId);
    const membership = await this.requireProjectAccess(task.projectId, user.userId, true);
    if (membership.role === ProjectRole.VIEWER) {
      throw new ForbiddenException('Viewers cannot update tasks.');
    }

    const updatedTask = await this.prismaService.task.update({
      where: { id: taskId },
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        dueDate: dto.dueDate,
        assigneeId: dto.assigneeId,
      },
    });

    await this.invalidateProjectCache(updatedTask.projectId);
    return { data: this.mapTask(updatedTask) };
  }

  async remove(taskId: string, user: AuthenticatedUser): Promise<ServiceResponse<{ deleted: boolean }>> {
    const task = await this.requireTaskAccess(taskId, user.userId);
    const membership = await this.requireProjectAccess(task.projectId, user.userId, true);
    if (membership.role === ProjectRole.VIEWER) {
      throw new ForbiddenException('Viewers cannot delete tasks.');
    }

    await this.prismaService.task.update({
      where: { id: taskId },
      data: { deletedAt: new Date() },
    });

    await this.invalidateProjectCache(task.projectId);
    return { data: { deleted: true } };
  }

  private async requireProjectAccess(projectId: string, userId: string, allowArchived: boolean) {
    const membership = await this.prismaService.projectMember.findFirst({
      where: {
        projectId,
        userId,
        project: {
          deletedAt: null,
          ...(allowArchived ? {} : { status: { not: 'ARCHIVED' as const } }),
        },
      },
      include: { project: true },
    });

    if (!membership) {
      throw new NotFoundException('Project was not found.');
    }

    return membership;
  }

  private async requireTaskAccess(taskId: string, userId: string) {
    const task = await this.prismaService.task.findFirst({
      where: {
        id: taskId,
        deletedAt: null,
        project: {
          members: {
            some: { userId },
          },
          deletedAt: null,
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task was not found.');
    }

    return task;
  }

  private async invalidateProjectCache(projectId: string): Promise<void> {
    const members = await this.prismaService.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    });
    await Promise.all(members.map(({ userId }) => this.redisService.del(`dashboard:${userId}`)));
  }

  private mapTask(task: {
    id: string;
    projectId: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: Date | null;
    assigneeId: string | null;
    reporterId: string;
    createdAt: Date;
    updatedAt: Date;
  }): TaskSummary {
    return { ...task };
  }
}