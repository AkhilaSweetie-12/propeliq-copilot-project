"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TasksService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const redis_service_1 = require("../../common/services/redis.service");
const prisma_service_1 = require("../../prisma/prisma.service");
let TasksService = class TasksService {
    prismaService;
    redisService;
    constructor(prismaService, redisService) {
        this.prismaService = prismaService;
        this.redisService = redisService;
    }
    async create(dto, user) {
        const membership = await this.requireProjectAccess(dto.projectId, user.userId, true);
        if (membership.role === client_1.ProjectRole.VIEWER) {
            throw new common_1.ForbiddenException('Viewers cannot create tasks.');
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
    async findAll(query, user) {
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
                        { title: { contains: query.search, mode: 'insensitive' } },
                        { description: { contains: query.search, mode: 'insensitive' } },
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
    async findOne(taskId, user) {
        const task = await this.requireTaskAccess(taskId, user.userId);
        return { data: this.mapTask(task) };
    }
    async update(taskId, dto, user) {
        const task = await this.requireTaskAccess(taskId, user.userId);
        const membership = await this.requireProjectAccess(task.projectId, user.userId, true);
        if (membership.role === client_1.ProjectRole.VIEWER) {
            throw new common_1.ForbiddenException('Viewers cannot update tasks.');
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
    async remove(taskId, user) {
        const task = await this.requireTaskAccess(taskId, user.userId);
        const membership = await this.requireProjectAccess(task.projectId, user.userId, true);
        if (membership.role === client_1.ProjectRole.VIEWER) {
            throw new common_1.ForbiddenException('Viewers cannot delete tasks.');
        }
        await this.prismaService.task.update({
            where: { id: taskId },
            data: { deletedAt: new Date() },
        });
        await this.invalidateProjectCache(task.projectId);
        return { data: { deleted: true } };
    }
    async requireProjectAccess(projectId, userId, allowArchived) {
        const membership = await this.prismaService.projectMember.findFirst({
            where: {
                projectId,
                userId,
                project: {
                    deletedAt: null,
                    ...(allowArchived ? {} : { status: { not: 'ARCHIVED' } }),
                },
            },
            include: { project: true },
        });
        if (!membership) {
            throw new common_1.NotFoundException('Project was not found.');
        }
        return membership;
    }
    async requireTaskAccess(taskId, userId) {
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
            throw new common_1.NotFoundException('Task was not found.');
        }
        return task;
    }
    async invalidateProjectCache(projectId) {
        const members = await this.prismaService.projectMember.findMany({
            where: { projectId },
            select: { userId: true },
        });
        await Promise.all(members.map(({ userId }) => this.redisService.del(`dashboard:${userId}`)));
    }
    mapTask(task) {
        return { ...task };
    }
};
exports.TasksService = TasksService;
exports.TasksService = TasksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService])
], TasksService);
//# sourceMappingURL=tasks.service.js.map