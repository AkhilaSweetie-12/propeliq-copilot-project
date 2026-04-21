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
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const redis_service_1 = require("../../common/services/redis.service");
const prisma_service_1 = require("../../prisma/prisma.service");
let DashboardService = class DashboardService {
    prismaService;
    redisService;
    constructor(prismaService, redisService) {
        this.prismaService = prismaService;
        this.redisService = redisService;
    }
    async overview(userId) {
        const cacheKey = `dashboard:${userId}`;
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
            return { data: cached };
        }
        const now = new Date();
        const [projectCount, activeTaskCount, overdueTaskCount, groupedTasks, upcomingTasks] = await Promise.all([
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
                    status: { not: client_1.TaskStatus.DONE },
                },
            }),
            this.prismaService.task.count({
                where: {
                    deletedAt: null,
                    project: { members: { some: { userId } } },
                    dueDate: { lt: now },
                    status: { not: client_1.TaskStatus.DONE },
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
        const taskBreakdown = {
            TODO: 0,
            IN_PROGRESS: 0,
            IN_REVIEW: 0,
            DONE: 0,
        };
        for (const item of groupedTasks) {
            taskBreakdown[item.status] = item._count.status;
        }
        const overview = {
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
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map