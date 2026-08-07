import { Request } from 'express';
import { User } from '@prisma/client';
import { JWTPayload } from 'jose';

export interface AuthenticatedUser {
  localUser: User;
  claims: JWTPayload;
}

export type AuthenticatedRequest = Request & { user: AuthenticatedUser };
