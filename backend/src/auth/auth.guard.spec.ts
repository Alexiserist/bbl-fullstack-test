import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  it('requires the authentication service to resolve every request', async () => {
    const auth = {
      authenticate: jest.fn().mockRejectedValue(new UnauthorizedException()),
    };
    const guard = new AuthGuard(auth as never);
    const request = { headers: {} };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as never;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auth.authenticate).toHaveBeenCalledWith(undefined);
  });
});
