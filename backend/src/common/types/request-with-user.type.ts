import type { ProjectRole, Role } from '@prisma/client';
import type { Request } from 'express';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: Role;
  projectRole?: ProjectRole;
  currentRefreshToken?: string;
}

export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
  cookies: Record<string, string | undefined>;
}