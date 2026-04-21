"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../../prisma/prisma.service");
const PASSWORD_ROUNDS = 12;
const REFRESH_TOKEN_COOKIE_PATH = '/api/v1/auth/refresh';
let AuthService = class AuthService {
    prismaService;
    jwtService;
    configService;
    constructor(prismaService, jwtService, configService) {
        this.prismaService = prismaService;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async register(dto) {
        const existingUser = await this.prismaService.user.findUnique({
            where: { email: dto.email },
            select: { id: true },
        });
        if (existingUser) {
            throw new common_1.ConflictException('Email is already in use.');
        }
        const passwordHash = await bcrypt.hash(dto.password, PASSWORD_ROUNDS);
        const user = await this.prismaService.user.create({
            data: {
                email: dto.email,
                passwordHash,
                firstName: dto.firstName,
                lastName: dto.lastName,
            },
        });
        const tokens = await this.issueTokens(user);
        await this.replaceRefreshTokens(user.id, tokens.refreshToken);
        return {
            response: {
                data: {
                    user: this.mapUser(user),
                    accessToken: tokens.accessToken,
                },
            },
            tokens,
        };
    }
    async login(dto) {
        const user = await this.prismaService.user.findUnique({
            where: { email: dto.email },
        });
        if (!user?.isActive) {
            throw new common_1.UnauthorizedException('Invalid credentials.');
        }
        const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
        if (!passwordMatches) {
            throw new common_1.UnauthorizedException('Invalid credentials.');
        }
        const tokens = await this.issueTokens(user);
        await this.replaceRefreshTokens(user.id, tokens.refreshToken);
        return {
            response: {
                data: {
                    user: this.mapUser(user),
                    accessToken: tokens.accessToken,
                },
            },
            tokens,
        };
    }
    async refresh(user) {
        const refreshedUser = await this.prismaService.user.findUnique({
            where: { id: user.userId },
        });
        if (!refreshedUser?.isActive || !user.currentRefreshToken) {
            throw new common_1.UnauthorizedException('Refresh token is invalid.');
        }
        await this.revokeRefreshToken(user.currentRefreshToken);
        const tokens = await this.issueTokens(refreshedUser);
        await this.replaceRefreshTokens(refreshedUser.id, tokens.refreshToken);
        return {
            response: {
                data: {
                    user: this.mapUser(refreshedUser),
                    accessToken: tokens.accessToken,
                },
            },
            tokens,
        };
    }
    async logout(userId) {
        await this.prismaService.refreshToken.updateMany({
            where: {
                userId,
                revokedAt: null,
            },
            data: {
                revokedAt: new Date(),
            },
        });
        return {
            data: { loggedOut: true },
        };
    }
    async me(userId) {
        const user = await this.prismaService.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('User was not found.');
        }
        return {
            data: this.mapUser(user),
        };
    }
    getRefreshCookieOptions() {
        const expires = new Date();
        expires.setDate(expires.getDate() + 7);
        return {
            httpOnly: true,
            secure: this.configService.get('app.nodeEnv') === 'production',
            sameSite: 'strict',
            path: REFRESH_TOKEN_COOKIE_PATH,
            expires,
        };
    }
    async issueTokens(user) {
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role ?? client_1.Role.USER,
        };
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.configService.getOrThrow('database.jwtSecret'),
                expiresIn: this.configService.getOrThrow('database.jwtAccessExpires'),
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.getOrThrow('database.jwtRefreshSecret'),
                expiresIn: this.configService.getOrThrow('database.jwtRefreshExpires'),
            }),
        ]);
        return { accessToken, refreshToken };
    }
    async replaceRefreshTokens(userId, refreshToken) {
        const tokenHash = (0, node_crypto_1.createHash)('sha256').update(refreshToken).digest('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        await this.prismaService.$transaction([
            this.prismaService.refreshToken.updateMany({
                where: { userId, revokedAt: null },
                data: { revokedAt: new Date() },
            }),
            this.prismaService.refreshToken.create({
                data: {
                    userId,
                    tokenHash,
                    expiresAt,
                },
            }),
        ]);
    }
    async revokeRefreshToken(refreshToken) {
        const tokenHash = (0, node_crypto_1.createHash)('sha256').update(refreshToken).digest('hex');
        await this.prismaService.refreshToken.updateMany({
            where: { tokenHash, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }
    mapUser(user) {
        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map