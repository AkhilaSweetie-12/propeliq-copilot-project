import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle, minutes } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RefreshAuthGuard } from '../../common/guards/refresh-auth.guard';
import type { ServiceResponse } from '../../common/types/api-response.type';
import type { AuthenticatedUser } from '../../common/types/request-with-user.type';
import type { AuthResponse, AuthUser } from './auth.types';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: minutes(15) } })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ServiceResponse<AuthResponse>> {
    const result = await this.authService.register(dto);
    response.cookie('refreshToken', result.tokens.refreshToken, this.authService.getRefreshCookieOptions());
    return result.response;
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: minutes(15) } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ServiceResponse<AuthResponse>> {
    const result = await this.authService.login(dto);
    response.cookie('refreshToken', result.tokens.refreshToken, this.authService.getRefreshCookieOptions());
    return result.response;
  }

  @Public()
  @UseGuards(RefreshAuthGuard)
  @Post('refresh')
  async refresh(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ServiceResponse<AuthResponse>> {
    const result = await this.authService.refresh(user);
    response.cookie('refreshToken', result.tokens.refreshToken, this.authService.getRefreshCookieOptions());
    return result.response;
  }

  @Post('logout')
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ServiceResponse<{ loggedOut: boolean }>> {
    response.clearCookie('refreshToken', this.authService.getRefreshCookieOptions());
    return this.authService.logout(user.userId);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): Promise<ServiceResponse<AuthUser>> {
    return this.authService.me(user.userId);
  }
}