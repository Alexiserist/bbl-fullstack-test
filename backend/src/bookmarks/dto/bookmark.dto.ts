import { Transform, Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

import { registerDecorator, ValidationOptions } from 'class-validator';

function IsHttpUrl(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    registerDecorator({
      name: 'isHttpUrl',
      target: target.constructor,
      propertyName: propertyKey.toString(),
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && value.length <= 2048 && isHttpUrl(value);
        },
        defaultMessage() {
          return 'must be an absolute HTTP or HTTPS URL no longer than 2048 characters';
        },
      },
    });
  };
}

export class CreateBookmarkDto {
  @Transform(trim)
  @IsString()
  @Length(1, 2048)
  @IsHttpUrl()
  url!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 300)
  title!: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(0, 10000)
  notes?: string | null;

  @IsOptional()
  @IsUUID()
  collectionId?: string | null;
}

export class UpdateBookmarkDto extends CreateBookmarkDto {}

export class PatchBookmarkDto {
  @Transform(trim)
  @ValidateIf((object) => object.url !== undefined)
  @IsString()
  @Length(1, 2048)
  @IsHttpUrl()
  url?: string;

  @Transform(trim)
  @ValidateIf((object) => object.title !== undefined)
  @IsString()
  @Length(1, 300)
  title?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(0, 10000)
  notes?: string | null;

  @IsOptional()
  @IsUUID()
  collectionId?: string | null;
}

export class BookmarkListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  collectionId?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value : value))
  uncategorized?: string;
}

export class NestedBookmarkListQueryDto extends PaginationQueryDto {}
