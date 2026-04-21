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
exports.ProjectsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const redis_service_1 = require("../../common/services/redis.service");
const prisma_service_1 = require("../../prisma/prisma.service");
let ProjectsService = class ProjectsService {
    prismaService;
    redisService;
    constructor(prismaService, redisService) {
        this.prismaService = prismaService;
        this.redisService = redisService;
    }
    async create(dto, user) {
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
                    role: client_1.ProjectRole.OWNER,
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
                role: client_1.ProjectRole.OWNER,
                createdAt: project.createdAt,
                updatedAt: project.updatedAt,
            },
        };
    }
    async findAll(query, user) {
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
                        { name: { contains: search, mode: 'insensitive' } },
                        { description: { contains: search, mode: 'insensitive' } },
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
                role: project.members[0]?.role ?? client_1.ProjectRole.VIEWER,
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
    async findOne(projectId, user) {
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
    async update(projectId, dto, user) {
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
    async remove(projectId, user) {
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
    async getProjectMembership(projectId, userId) {
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
            throw new common_1.NotFoundException('Project was not found.');
        }
        return membership;
    }
    assertCanManageProject(role) {
        if (role !== client_1.ProjectRole.OWNER && role !== client_1.ProjectRole.ADMIN) {
            throw new common_1.ForbiddenException('You do not have permission to update this project.');
        }
    }
    async invalidateProjectCache(projectId) {
        const members = await this.prismaService.projectMember.findMany({
            where: { projectId },
            select: { userId: true },
        });
        await Promise.all(members.map(({ userId }) => this.redisService.del(`dashboard:${userId}`)));
    }
};
exports.ProjectsService = ProjectsService;
exports.ProjectsService = ProjectsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService])
], ProjectsService);
//# sourceMappingURL=projects.service.js.map