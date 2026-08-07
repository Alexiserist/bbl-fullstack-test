import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

interface UserInfoProfile {
  email?: unknown;
  name?: unknown;
}

@Injectable()
export class UsersService {
  private readonly userinfoTimeoutMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const configuredTimeout = Number(
      this.config.get<string>('USERINFO_TIMEOUT_MS') ?? 1500,
    );
    this.userinfoTimeoutMs =
      Number.isFinite(configuredTimeout) && configuredTimeout > 0
        ? configuredTimeout
        : 1500;
  }

  async resolveOrCreate(
    authIssuer: string,
    authSubject: string,
    accessToken: string,
    userinfoUri: string,
  ): Promise<User> {
    const existing = await this.prisma.user.findUnique({
      where: { authIssuer_authSubject: { authIssuer, authSubject } },
    });
    if (existing) return existing;

    let created: User;
    try {
      created = await this.prisma.user.create({ data: { authIssuer, authSubject } });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
      const concurrent = await this.prisma.user.findUnique({
        where: { authIssuer_authSubject: { authIssuer, authSubject } },
      });
      if (!concurrent) throw error;
      return concurrent;
    }

    const profile = await this.fetchUserInfo(accessToken, userinfoUri);
    if (!profile) return created;

    return this.prisma.user.update({
      where: { id: created.id },
      data: {
        email: this.profileString(profile.email, 320),
        name: this.profileString(profile.name, 150),
      },
    });
  }

  private async fetchUserInfo(
    accessToken: string,
    userinfoUri: string,
  ): Promise<UserInfoProfile | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.userinfoTimeoutMs);
    try {
      const response = await fetch(userinfoUri, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
      if (!response.ok) return null;
      const body: unknown = await response.json();
      return body && typeof body === 'object' ? (body as UserInfoProfile) : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private profileString(value: unknown, maxLength: number): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
  }

  toProfile(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
