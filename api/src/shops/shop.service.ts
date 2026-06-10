import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shop } from './shop.entity';
import { CreateShopDto } from './dto/create-shop.dto';

@Injectable()
export class ShopService {
  constructor(@InjectRepository(Shop) private repo: Repository<Shop>) {}

  findById(id: string): Promise<Shop | null> {
    return this.repo.findOneBy({ id });
  }

  create(userId: string, dto: CreateShopDto): Promise<Shop> {
    return this.repo.save(this.repo.create({ ...dto, userId }));
  }

  findAllByUser(userId: string): Promise<Shop[]> {
    return this.repo.findBy({ userId });
  }

  update(id: string, userId: string, dto: Partial<CreateShopDto>): Promise<Shop> {
    return this.repo.save({ id, userId, ...dto });
  }

  async remove(id: string, userId: string): Promise<Shop> {
    if (!(await this.repo.findOneBy({ id, userId }))) {
      throw new Error('Shop not found or not owned by user');
    }
    return this.repo.remove({ id, userId } as Shop);
  }
}
