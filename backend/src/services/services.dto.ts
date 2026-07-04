import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ServiceType, ServiceTier, ServiceLifecycle } from '../common/enums/catalog.enums';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(ServiceType)
  type: ServiceType;

  @IsEnum(ServiceTier)
  tier: ServiceTier;

  @IsEnum(ServiceLifecycle)
  lifecycle: ServiceLifecycle;

  @IsOptional()
  @IsString()
  ownerTeamId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  repository?: string;
}
