import { User } from '../users/user.entity';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, ManyToOne } from 'typeorm';

export enum AvailabilityTier {
  STANDARD = 'standard',
  HIGH = 'high',
}

export enum DatabaseType {
  STANDARD = 'standard',
  LIGHT = 'light',
}

@Entity('shops')
export class Shop {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'enum', enum: AvailabilityTier })
  availabilityTier: AvailabilityTier;

  @Column({ type: 'enum', enum: DatabaseType })
  databaseType: DatabaseType;

  @Column()
  walletAddress: string;

  @ManyToOne(() => User)
  user: User;

  @Column()
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
