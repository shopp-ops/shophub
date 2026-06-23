import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { AvailabilityTier, DatabaseType } from '../shop.entity';

export class CreateShopDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  adminEmail: string;

  @IsEnum(AvailabilityTier)
  availabilityTier: AvailabilityTier;

  @IsString()
  @IsOptional()
  walletAddress?: string;

  @IsEnum(DatabaseType)
  databaseType: DatabaseType;
}
