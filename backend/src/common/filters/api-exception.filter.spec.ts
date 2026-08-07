import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';

const makeHost = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return {
    host: {
      switchToHttp: () => ({ getResponse: () => ({ status, json }) }),
    } as never,
    status,
    json,
  };
};

describe('ApiExceptionFilter', () => {
  it('uses one generic 404 envelope for missing and private resources', () => {
    const filter = new ApiExceptionFilter();
    const missing = makeHost();
    const privateResource = makeHost();

    filter.catch(new NotFoundException(), missing.host);
    filter.catch(new NotFoundException(), privateResource.host);

    expect(missing.status).toHaveBeenCalledWith(404);
    expect(privateResource.status).toHaveBeenCalledWith(404);
    expect(missing.json).toHaveBeenCalledWith({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Resource not found',
      details: [],
    });
    expect(privateResource.json).toHaveBeenCalledWith(
      missing.json.mock.calls[0][0],
    );
  });

  it('does not expose details for unauthorized responses', () => {
    const filter = new ApiExceptionFilter();
    const output = makeHost();

    filter.catch(new UnauthorizedException(), output.host);

    expect(output.json).toHaveBeenCalledWith({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Unauthorized',
      details: [],
    });
  });

  it('maps unexpected exceptions to a generic 500 without exposing internals', () => {
    const filter = new ApiExceptionFilter();
    const output = makeHost();
    const secret = 'database password and raw token';

    filter.catch(new Error(secret), output.host);

    expect(output.status).toHaveBeenCalledWith(500);
    expect(output.json).toHaveBeenCalledWith({
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
      details: [],
    });
    expect(JSON.stringify(output.json.mock.calls)).not.toContain(secret);
  });
});
