import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, errors, JWTPayload, jwtVerify } from 'jose';
import { UsersService } from '../users/users.service';
import { AuthenticatedUser } from './auth.types';

const CLOCK_TOLERANCE_SECONDS = 60;

@Injectable()
export class AuthService {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly clientId: string;
  private readonly clientClaim: 'azp' | 'client_id';
  private readonly jwksUri: string;
  private readonly userinfoUri: string;
  private remoteJwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
  ) {
    this.issuer =
      this.config.get<string>('AUTH0_ISSUER') ?? 'https://dev-yg.us.auth0.com/';
    this.audience =
      this.config.get<string>('AUTH0_AUDIENCE') ?? 'https://bbl-candidate-test-api';
    this.clientId = this.config.get<string>('AUTH0_CLIENT_ID') ?? '';
    const configuredClaim = this.config.get<string>('AUTH0_CLIENT_CLAIM') ?? 'azp';
    this.clientClaim = configuredClaim === 'client_id' ? 'client_id' : 'azp';
    this.jwksUri =
      this.config.get<string>('AUTH0_JWKS_URI') ??
      'https://dev-yg.us.auth0.com/.well-known/jwks.json';
    this.userinfoUri =
      this.config.get<string>('AUTH0_USERINFO_URI') ??
      'https://dev-yg.us.auth0.com/userinfo';
    this.remoteJwks = createRemoteJWKSet(new URL(this.jwksUri));
  }

  async authenticate(authorizationHeader: string | undefined): Promise<AuthenticatedUser> {
    const token = this.extractBearerToken(authorizationHeader);
    const claims = await this.verifyAccessToken(token);
    const issuer = claims.iss as string;
    const subject = claims.sub as string;
    const localUser = await this.users.resolveOrCreate(
      issuer,
      subject,
      token,
      this.userinfoUri,
    );

    return { localUser, claims };
  }

  private extractBearerToken(header: string | undefined): string {
    if (!header) throw new UnauthorizedException();
    const match = /^Bearer ([^\s]+)$/.exec(header);
    if (!match) throw new UnauthorizedException();
    return match[1];
  }

  private async verifyAccessToken(token: string): Promise<JWTPayload> {
    if (!this.clientId) throw new UnauthorizedException();

    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, this.remoteJwks, {
        algorithms: ['RS256'],
        issuer: this.issuer,
        audience: this.audience,
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
        requiredClaims: ['iss', 'sub', 'aud', 'exp', 'iat'],
      }));
    } catch (error) {
      if (error instanceof errors.JWKSNoMatchingKey) {
        this.remoteJwks = createRemoteJWKSet(new URL(this.jwksUri));
        try {
          ({ payload } = await jwtVerify(token, this.remoteJwks, {
            algorithms: ['RS256'],
            issuer: this.issuer,
            audience: this.audience,
            clockTolerance: CLOCK_TOLERANCE_SECONDS,
            requiredClaims: ['iss', 'sub', 'aud', 'exp', 'iat'],
          }));
        } catch {
          throw new UnauthorizedException();
        }
      } else {
        throw new UnauthorizedException();
      }
    }

    if (typeof payload.sub !== 'string' || payload.sub.trim() === '') {
      throw new UnauthorizedException();
    }
    if (
      typeof payload.iat !== 'number' ||
      !Number.isFinite(payload.iat) ||
      payload.iat > Date.now() / 1000 + CLOCK_TOLERANCE_SECONDS
    ) {
      throw new UnauthorizedException();
    }
    if (
      typeof payload.exp !== 'number' ||
      !Number.isFinite(payload.exp)
    ) {
      throw new UnauthorizedException();
    }
    if (
      payload.nbf !== undefined &&
      (typeof payload.nbf !== 'number' || !Number.isFinite(payload.nbf))
    ) {
      throw new UnauthorizedException();
    }
    const clientClaim = payload[this.clientClaim];
    if (typeof clientClaim !== 'string' || clientClaim !== this.clientId) {
      throw new UnauthorizedException();
    }

    return payload;
  }
}
