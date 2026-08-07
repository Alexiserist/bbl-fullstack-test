import { Controller, Get } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { ApiMessage } from '../common/api-response';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';

@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiMessage('User retrieved')
  getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    return this.users.toProfile(user.localUser);
  }
}
