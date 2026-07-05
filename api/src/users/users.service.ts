import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { MetricsService } from 'src/observability/metrics.service';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>,
              private readonly metrics: MetricsService,) {}

  async findByEmail(email: string): Promise<User | null> {
    const start = process.hrtime();
    const user = await this.repo.findOneBy({ email });
    const [sec, nano] = process.hrtime(start);
    this.metrics.userDuration.observe(
      { operation: 'findByEmail' },
      sec + nano / 1e9,
    );
    return user;
  }

  async findById(id: string): Promise<User | null> {
    const start = process.hrtime();
    const user = await this.repo.findOneBy({ id });
    const [sec, nano] = process.hrtime(start);
    this.metrics.userDuration.observe(
      { operation: 'findById' },
      sec + nano / 1e9,
    );
    return user;
  }

  async create(email: string, passwordHash: string): Promise<User> {
    const start = process.hrtime();
    const user = await this.repo.save(this.repo.create({ email, passwordHash }));
    this.metrics.userCreated.inc();
    const [sec, nano] = process.hrtime(start);
    this.metrics.userDuration.observe(
      { operation: 'create' },
      sec + nano / 1e9,
    );
    return user;
  }
}
