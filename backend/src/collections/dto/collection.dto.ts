import { Transform } from 'class-transformer';
import { IsString, Length, ValidateIf } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCollectionDto {
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name!: string;
}

export class UpdateCollectionDto extends CreateCollectionDto {}

export class PatchCollectionDto {
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name!: string;
}

export class CollectionListQueryDto extends PaginationQueryDto {
  @IsString()
  @Length(1, 100)
  @Transform(trim)
  @ValidateIf((object) => object.name !== undefined)
  name?: string;
}
