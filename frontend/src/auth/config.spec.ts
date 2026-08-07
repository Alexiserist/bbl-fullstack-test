import { describe, expect, it } from 'vitest';
import { authCacheLocation } from './config';

describe('Auth0 browser cache configuration', () => {
  it('uses the SDK-managed persistent cache so authentication survives reloads', () => {
    expect(authCacheLocation).toBe('localstorage');
  });
});
