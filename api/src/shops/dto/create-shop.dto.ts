import { IsEnum, IsString, MinLength } from 'class-validator';
import { AvailabilityTier, DatabaseType } from '../shop.entity';

export class CreateShopDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEnum(AvailabilityTier)
  availabilityTier: AvailabilityTier;

  @IsString()
  walletAddress: string;

  @IsEnum(DatabaseType)
  databaseType: DatabaseType;
}
