import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { BetStatus } from '../enums/bet-status.enum';
import { Round } from './round.entity';

@Entity({ schema: 'game' })
@Unique(['roundId', 'operatorPlayerId'])
@Index(['roundId'])
@Index(['operatorPlayerId'])
export class Bet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  roundId: string;

  @Column({ type: 'varchar', length: 64 })
  operatorId: string;

  @Column({ type: 'varchar', length: 128 })
  operatorPlayerId: string;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  amount: string;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  autoCashoutAt: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  cashoutMultiplier: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true })
  payout: string | null;

  @Column({ type: 'enum', enum: BetStatus, default: BetStatus.PENDING })
  status: BetStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Round, (round) => round.bets)
  @JoinColumn({ name: 'roundId' })
  round: Round;
}
