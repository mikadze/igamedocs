import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { Bet } from './bet.entity';
import { SeedAuditLog } from './seed-audit-log.entity';

@Entity({ schema: 'game' })
export class Round {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  operatorId: string;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  crashPoint: string | null;

  @Column({ type: 'int', default: 10000 })
  bettingWindowMs: number;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  crashedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  settledAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => Bet, (bet) => bet.round)
  bets: Bet[];

  @OneToOne(() => SeedAuditLog, (log) => log.round)
  seedAuditLog: SeedAuditLog;
}
