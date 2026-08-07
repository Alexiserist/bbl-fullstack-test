import { Module } from '@nestjs/common';
import { BookmarksModule } from '../bookmarks/bookmarks.module';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';

@Module({
  imports: [BookmarksModule],
  controllers: [CollectionsController],
  providers: [CollectionsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
