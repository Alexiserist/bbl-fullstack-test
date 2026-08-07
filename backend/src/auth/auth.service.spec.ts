import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { exportJWK, generateKeyPair, SignJWT, type KeyLike } from 'jose';
import { AuthService } from './auth.service';

const issuer = 'https://tenant.example.test/';
const audience = 'https://bbl-candidate-test-api';
const clientId = 'assignment-client-id';
const user = {
  id: '11111111-1111-4111-8111-111111111111',
  authIssuer: issuer,
  authSubject: 'auth0|subject',
  email: null,
  name: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

interface SigningFixture {
  kid: string;
  privateKey: KeyLike;
  jwk: Record<string, unknown>;
}

describe('AuthService token validation', () => {
  let server: Server;
  let jwksUri: string;
  let activeKeys: Record<string, unknown>[];
  let requestCount: number;
  let keyOne: SigningFixture;
  let keyTwo: SigningFixture;
  let service: AuthService;
  const users = { resolveOrCreate: jest.fn().mockResolvedValue(user) };

  beforeAll(async () => {
    keyOne = await makeKey('key-one');
    keyTwo = await makeKey('key-two');
    activeKeys = [keyOne.jwk];
    requestCount = 0;
    server = createServer((request, response) => {
      if (request.url !== '/jwks') {
        response.writeHead(404).end();
        return;
      }
      requestCount += 1;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ keys: activeKeys }));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind');
    jwksUri = `http://127.0.0.1:${address.port}/jwks`;
    service = makeService();
  });

  afterAll(async () => {
    server.close();
    await once(server, 'close');
  });

  beforeEach(() => {
    users.resolveOrCreate.mockClear();
    activeKeys = [keyOne.jwk];
  });

  it.each([
    ['wrong issuer', { issuer: 'https://wrong.example.test/' }],
    ['wrong audience', { audience: 'https://wrong-api.example.test' }],
    ['wrong client', { azp: 'another-client' }],
    ['future iat', { issuedAt: Math.floor(Date.now() / 1000) + 120 }],
    ['future nbf', { notBefore: Math.floor(Date.now() / 1000) + 120 }],
  ])('rejects %s', async (_label, overrides) => {
    const token = await sign(keyOne, overrides);
    await expect(service.authenticate(`Bearer ${token}`)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(users.resolveOrCreate).not.toHaveBeenCalled();
  });

  it('rejects missing, expired, malformed, tampered, and ID tokens', async () => {
    const now = Math.floor(Date.now() / 1000);
    const missingIat = await new SignJWT({ aud: audience, azp: clientId })
      .setProtectedHeader({ alg: 'RS256', kid: keyOne.kid })
      .setIssuer(issuer)
      .setSubject('auth0|subject')
      .setExpirationTime(now + 60)
      .sign(keyOne.privateKey);
    const expired = await sign(keyOne, { expiration: now - 61 });
    const malformed = 'not-a-jwt';
    const tampered = `${await sign(keyOne)}x`;
    const idToken = await sign(keyOne, { audience: clientId });

    for (const token of [missingIat, expired, malformed, tampered, idToken]) {
      await expect(service.authenticate(`Bearer ${token}`)).rejects.toBeInstanceOf(UnauthorizedException);
    }
  });

  it('rejects unsupported and none algorithms', async () => {
    const header = encode({ alg: 'none', typ: 'JWT', kid: keyOne.kid });
    const payload = encode({ iss: issuer, sub: 'auth0|subject', aud: audience, exp: Date.now() / 1000 + 60, iat: Date.now() / 1000, azp: clientId });
    const noneToken = `${header}.${payload}.`;
    await expect(service.authenticate(`Bearer ${noneToken}`)).rejects.toBeInstanceOf(UnauthorizedException);

    const hs256 = `${encode({ alg: 'HS256', typ: 'JWT', kid: keyOne.kid })}.${payload}.not-a-signature`;
    await expect(service.authenticate(`Bearer ${hs256}`)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refreshes JWKS once when a new kid appears', async () => {
    const firstToken = await sign(keyOne);
    await service.authenticate(`Bearer ${firstToken}`);
    const initialRequests = requestCount;
    activeKeys = [keyTwo.jwk];

    const secondToken = await sign(keyTwo);
    await expect(service.authenticate(`Bearer ${secondToken}`)).resolves.toEqual({ localUser: user, claims: expect.any(Object) });
    expect(requestCount).toBeGreaterThanOrEqual(initialRequests + 1);
  });

  it('never logs the raw bearer credential on validation failure', async () => {
    const token = await sign(keyOne);
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(service.authenticate(`Bearer ${token}tampered`)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(log.mock.calls.flat().join(' ')).not.toContain(token);
    expect(error.mock.calls.flat().join(' ')).not.toContain(token);
    log.mockRestore();
    error.mockRestore();
  });

  async function makeKey(kid: string): Promise<SigningFixture> {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    return { kid, privateKey, jwk: { ...jwk, kid, alg: 'RS256', use: 'sig' } };
  }

  function makeService() {
    const values: Record<string, string> = {
      AUTH0_ISSUER: issuer,
      AUTH0_AUDIENCE: audience,
      AUTH0_CLIENT_ID: clientId,
      AUTH0_CLIENT_CLAIM: 'azp',
      AUTH0_JWKS_URI: jwksUri,
      AUTH0_USERINFO_URI: 'http://127.0.0.1/userinfo',
    };
    const config = { get: (key: string) => values[key] } as unknown as ConfigService;
    return new AuthService(config, users as never);
  }

  async function sign(
    fixture: SigningFixture,
    overrides: {
      issuer?: string;
      audience?: string;
      azp?: string;
      issuedAt?: number;
      notBefore?: number;
      expiration?: number;
    } = {},
  ) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ azp: overrides.azp ?? clientId })
      .setProtectedHeader({ alg: 'RS256', kid: fixture.kid, typ: 'JWT' })
      .setIssuer(overrides.issuer ?? issuer)
      .setAudience(overrides.audience ?? audience)
      .setSubject('auth0|subject')
      .setIssuedAt(overrides.issuedAt ?? now)
      .setExpirationTime(overrides.expiration ?? now + 300)
      .setNotBefore(overrides.notBefore ?? now)
      .sign(fixture.privateKey);
  }

  function encode(value: unknown) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }
});
