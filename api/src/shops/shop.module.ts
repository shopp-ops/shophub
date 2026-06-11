import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShopController } from './shop.controller';
import { Shop } from './shop.entity';
import { ShopService } from './shop.service';

@Module({
  imports: [TypeOrmModule.forFeature([Shop])],
  controllers: [ShopController],
  providers: [ShopService],
})
export class ShopsModule {}
