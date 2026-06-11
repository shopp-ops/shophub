import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { Shop } from './shop.entity';

@Injectable()
export class ShopService {
  constructor(@InjectRepository(Shop) private repo: Repository<Shop>) {}

  async findByIdForUser(id: string, userId: string): Promise<Shop> {
    const shop = await this.repo.findOneBy({ id });
    if (!shop) throw new NotFoundException('Shop not found');
    if (shop.userId !== userId) throw new ForbiddenException();
    return shop;
  }

  create(userId: string, dto: CreateShopDto): Promise<Shop> {
    return this.repo.save(this.repo.create({ ...dto, userId }));
  }

  findAllByUser(userId: string): Promise<Shop[]> {
    return this.repo.findBy({ userId });
  }

  async update(id: string, userId: string, dto: UpdateShopDto): Promise<Shop> {
    const shop = await this.findByIdForUser(id, userId);
    return this.repo.save({ ...shop, ...dto });
  }

  async remove(id: string, userId: string): Promise<void> {
    const shop = await this.findByIdForUser(id, userId);
    await this.repo.remove(shop);
  }
}
