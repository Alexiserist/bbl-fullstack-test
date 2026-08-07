import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { ApiMessage } from '../common/api-response';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  BookmarkListQueryDto,
  CreateBookmarkDto,
  PatchBookmarkDto,
} from './dto/bookmark.dto';
import { BookmarksService } from './bookmarks.service';

@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly bookmarks: BookmarksService) {}

  @Get()
  @ApiMessage('Bookmarks retrieved')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: BookmarkListQueryDto) {
    return this.bookmarks.findAll(user.localUser.id, query);
  }

  @Post()
  @HttpCode(201)
  @ApiMessage('Bookmark created')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBookmarkDto) {
    return this.bookmarks.create(user.localUser.id, dto);
  }

  @Get(':id')
  @ApiMessage('Bookmark retrieved')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookmarks.findOne(user.localUser.id, id);
  }

  @Put(':id')
  @ApiMessage('Bookmark updated')
  replace(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateBookmarkDto,
  ) {
    return this.bookmarks.replace(user.localUser.id, id, dto);
  }

  @Patch(':id')
  @ApiMessage('Bookmark updated')
  patch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchBookmarkDto,
  ) {
    return this.bookmarks.patch(user.localUser.id, id, dto);
  }

  @Delete(':id')
  @ApiMessage('Bookmark deleted')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookmarks.remove(user.localUser.id, id);
  }
}
