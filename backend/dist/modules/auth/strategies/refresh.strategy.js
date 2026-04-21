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
exports.RefreshStrategy = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const passport_1 = require("@nestjs/passport");
const node_crypto_1 = require("node:crypto");
const passport_jwt_1 = require("passport-jwt");
const prisma_service_1 = require("../../../prisma/prisma.service");
let RefreshStrategy = class RefreshStrategy extends (0, passport_1.PassportStrategy)(passport_jwt_1.Strategy, 'jwt-refresh') {
    prismaService;
    constructor(configService, prismaService) {
        super({
            jwtFromRequest: passport_jwt_1.ExtractJwt.fromExtractors([
                (request) => request?.cookies?.refreshToken ?? null,
            ]),
            ignoreExpiration: false,
            secretOrKey: configService.getOrThrow('database.jwtRefreshSecret'),
            passReqToCallback: true,
        });
        this.prismaService = prismaService;
    }
    async validate(request, payload) {
        const refreshToken = request.cookies?.refreshToken;
        if (!refreshToken) {
            throw new common_1.UnauthorizedException('Refresh token is required.');
        }
        const tokenHash = (0, node_crypto_1.createHash)('sha256').update(refreshToken).digest('hex');
        const storedToken = await this.prismaService.refreshToken.findUnique({
            where: { tokenHash },
        });
        if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
            throw new common_1.UnauthorizedException('Refresh token is invalid.');
        }
        return {
            userId: payload.sub,
            email: payload.email,
            role: payload.role ?? client_1.Role.USER,
            currentRefreshToken: refreshToken,
        };
    }
};
exports.RefreshStrategy = RefreshStrategy;
exports.RefreshStrategy = RefreshStrategy = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], RefreshStrategy);
//# sourceMappingURL=refresh.strategy.js.map