import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { MetricsService } from '../observability/metrics.service';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>,
              private readonly metrics: MetricsService,) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOneBy({ email });
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findOneBy({ id });
  }

  async create(email: string, passwordHash: string): Promise<User> {
    const user = await this.repo.save(this.repo.create({ email, passwordHash }));
    this.metrics.userCreated.inc();
    return user;
  }
}
