import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AvailabilityTier, DatabaseType } from '../shop.entity';

export class UpdateShopDto {
  @IsEnum(AvailabilityTier)
  @IsOptional()
  availabilityTier?: AvailabilityTier;

  @IsString()
  @IsOptional()
  walletAddress?: string;

  @IsEnum(DatabaseType)
  @IsOptional()
  databaseType?: DatabaseType;
}
