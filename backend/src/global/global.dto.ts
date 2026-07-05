import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty, IsEnum, IsNumberString } from 'class-validator';

export class SearchDto {
  @IsString()
  @IsOptional()
  search?: string;
}

export class ImageDto {
  @IsNotEmpty({ message: 'Image data is required' })
  @IsString()
  data: string;

  @IsNotEmpty({ message: 'Image extension is required' })
  @IsString()
  ext: string;
}

export class LocalizedString {
  en: string;
  ar: string;
  fr: string;
}

/**
 * @class PaginationQueryDto
 * @description Standardized DTO for handling pagination, sorting, and global search
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'The page number to retrieve',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsNumberString()
  page?: string;

  @ApiPropertyOptional({
    description: 'Number of records per page',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @IsNumberString()
  limit?: string;

  @ApiPropertyOptional({
    description: 'Global search term (searches Name, SKU, and Category)',
    example: 'Server',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Field name to sort by',
    example: 'name',
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['asc', 'desc'],
    example: 'desc',
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc', 'ASC', 'DESC'])
  sort?: 'asc' | 'desc' | 'ASC' | 'DESC';

  @ApiPropertyOptional({
    description: 'JSON string for advanced filtering',
    example: '{"category": "Hardware"}',
  })
  @IsOptional()
  @IsString()
  filter?: string;
}
