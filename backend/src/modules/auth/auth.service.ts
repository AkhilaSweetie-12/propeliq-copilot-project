import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role, type User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import type { StringValue } from 'ms';
import type { ServiceResponse } from '../../common/types/api-response.type';
import type { AuthenticatedUser } from '../../common/types/request-with-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthResponse, AuthTokens, AuthUser, JwtPayload } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const PASSWORD_ROUNDS = 12;
const REFRESH_TOKEN_COOKIE_PATH = '/api/v1/auth/refresh';

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<{ response: ServiceResponse<AuthResponse>; tokens: AuthTokens }> {
    const existingUser = await this.prismaService.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('Email is already in use.');
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

  async login(dto: LoginDto): Promise<{ response: ServiceResponse<AuthResponse>; tokens: AuthTokens }> {
    const user = await this.prismaService.user.findUnique({
      where: { email: dto.email },
    });

    if (!user?.isActive) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials.');
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

  async refresh(user: AuthenticatedUser): Promise<{ response: ServiceResponse<AuthResponse>; tokens: AuthTokens }> {
    const refreshedUser = await this.prismaService.user.findUnique({
      where: { id: user.userId },
    });

    if (!refreshedUser?.isActive || !user.currentRefreshToken) {
      throw new UnauthorizedException('Refresh token is invalid.');
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

  async logout(userId: string): Promise<ServiceResponse<{ loggedOut: boolean }>> {
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

  async me(userId: string): Promise<ServiceResponse<AuthUser>> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User was not found.');
    }

    return {
      data: this.mapUser(user),
    };
  }

  getRefreshCookieOptions(): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict';
    path: string;
    expires: Date;
  } {
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);

    return {
      httpOnly: true,
      secure: this.configService.get<string>('app.nodeEnv') === 'production',
      sameSite: 'strict',
      path: REFRESH_TOKEN_COOKIE_PATH,
      expires,
    };
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role ?? Role.USER,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('database.jwtSecret'),
        expiresIn: this.configService.getOrThrow<StringValue>('database.jwtAccessExpires'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('database.jwtRefreshSecret'),
        expiresIn: this.configService.getOrThrow<StringValue>('database.jwtRefreshExpires'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async replaceRefreshTokens(userId: string, refreshToken: string): Promise<void> {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
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

  private async revokeRefreshToken(refreshToken: string): Promise<void> {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    await this.prismaService.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private mapUser(user: User): AuthUser {
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
}