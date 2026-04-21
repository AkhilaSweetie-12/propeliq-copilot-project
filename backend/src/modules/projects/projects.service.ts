import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectRole, ProjectStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { RedisService } from '../../common/services/redis.service';
import type { ServiceResponse } from '../../common/types/api-response.type';
import type { AuthenticatedUser } from '../../common/types/request-with-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  role: ProjectRole;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async create(
    dto: CreateProjectDto,
    user: AuthenticatedUser,
  ): Promise<ServiceResponse<ProjectSummary>> {
    const project = await this.prismaService.$transaction(async (tx) => {
      const createdProject = await tx.project.create({
        data: {
          name: dto.name,
          description: dto.description,
          ownerId: user.userId,
        },
      });

      await tx.projectMember.create({
        data: {
          projectId: createdProject.id,
          userId: user.userId,
          role: ProjectRole.OWNER,
        },
      });

      return createdProject;
    });

    await this.redisService.del(`dashboard:${user.userId}`);

    return {
      data: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        role: ProjectRole.OWNER,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    };
  }

  async findAll(
    query: PaginationDto,
    user: AuthenticatedUser,
  ): Promise<ServiceResponse<ProjectSummary[]>> {
    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where = {
      deletedAt: null,
      members: {
        some: {
          userId: user.userId,
        },
      },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { description: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, projects] = await Promise.all([
      this.prismaService.project.count({ where }),
      this.prismaService.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          members: {
            where: { userId: user.userId },
            select: { role: true },
          },
        },
      }),
    ]);

    return {
      data: projects.map((project) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        role: project.members[0]?.role ?? ProjectRole.VIEWER,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(projectId: string, user: AuthenticatedUser): Promise<ServiceResponse<ProjectSummary>> {
    const project = await this.getProjectMembership(projectId, user.userId);

    return {
      data: {
        id: project.project.id,
        name: project.project.name,
        description: project.project.description,
        status: project.project.status,
        role: project.role,
        createdAt: project.project.createdAt,
        updatedAt: project.project.updatedAt,
      },
    };
  }

  async update(
    projectId: string,
    dto: UpdateProjectDto,
    user: AuthenticatedUser,
  ): Promise<ServiceResponse<ProjectSummary>> {
    const membership = await this.getProjectMembership(projectId, user.userId);
    this.assertCanManageProject(membership.role);

    const project = await this.prismaService.project.update({
      where: { id: projectId },
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status,
      },
    });

    await this.invalidateProjectCache(projectId);

    return {
      data: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        role: membership.role,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    };
  }

  async remove(projectId: string, user: AuthenticatedUser): Promise<ServiceResponse<{ deleted: boolean }>> {
    const membership = await this.getProjectMembership(projectId, user.userId);
    this.assertCanManageProject(membership.role);

    await this.prismaService.project.update({
      where: { id: projectId },
      data: {
        deletedAt: new Date(),
      },
    });

    await this.invalidateProjectCache(projectId);

    return {
      data: { deleted: true },
    };
  }

  private async getProjectMembership(projectId: string, userId: string) {
    const membership = await this.prismaService.projectMember.findFirst({
      where: {
        projectId,
        userId,
        project: {
          deletedAt: null,
        },
      },
      include: {
        project: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('Project was not found.');
    }

    return membership;
  }

  private assertCanManageProject(role: ProjectRole): void {
    if (role !== ProjectRole.OWNER && role !== ProjectRole.ADMIN) {
      throw new ForbiddenException('You do not have permission to update this project.');
    }
  }

  private async invalidateProjectCache(projectId: string): Promise<void> {
    const members = await this.prismaService.projectMember.findMany({
      where: { projectId },
      select: { userId: true },
    });

    await Promise.all(members.map(({ userId }) => this.redisService.del(`dashboard:${userId}`)));
  }
}