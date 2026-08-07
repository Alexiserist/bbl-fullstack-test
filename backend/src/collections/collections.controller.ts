import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiMessage } from '../common/api-response';
import {
  CollectionListQueryDto,
  CreateCollectionDto,
  PatchCollectionDto,
} from './dto/collection.dto';
import { CollectionsService } from './collections.service';
import { BookmarksService } from '../bookmarks/bookmarks.service';
import { NestedBookmarkListQueryDto } from '../bookmarks/dto/bookmark.dto';

@Controller('collections')
export class CollectionsController {
  constructor(
    private readonly collections: CollectionsService,
    private readonly bookmarks: BookmarksService,
  ) {}

  @Get()
  @ApiMessage('Collections retrieved')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: CollectionListQueryDto) {
    return this.collections.findAll(user.localUser.id, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiMessage('Collection created')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCollectionDto) {
    return this.collections.create(user.localUser.id, dto);
  }

  @Get(':id/bookmarks')
  @ApiMessage('Bookmarks retrieved')
  findBookmarks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: NestedBookmarkListQueryDto,
  ) {
    return this.bookmarks.findByCollection(user.localUser.id, id, query);
  }

  @Get(':id')
  @ApiMessage('Collection retrieved')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.collections.findOne(user.localUser.id, id);
  }

  @Put(':id')
  @ApiMessage('Collection updated')
  replace(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCollectionDto,
  ) {
    return this.collections.replace(user.localUser.id, id, dto);
  }

  @Patch(':id')
  @ApiMessage('Collection updated')
  patch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchCollectionDto,
  ) {
    return this.collections.patch(user.localUser.id, id, dto);
  }

  @Delete(':id')
  @ApiMessage('Collection deleted')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.collections.remove(user.localUser.id, id);
  }
}
