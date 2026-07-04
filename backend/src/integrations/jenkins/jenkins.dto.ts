import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class JenkinsConfigDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  baseUrl: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  token?: string;
}
