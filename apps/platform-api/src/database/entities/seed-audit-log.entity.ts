import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Round } from './round.entity';

@Entity({ schema: 'game' })
export class SeedAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  roundId: string;

  @Column({ type: 'varchar', length: 128 })
  serverSeed: string;

  @Column({ type: 'varchar', length: 128 })
  serverSeedHash: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  clientSeed: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  combinedHash: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  derivedCrashPoint: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @OneToOne(() => Round, (round) => round.seedAuditLog)
  @JoinColumn({ name: 'roundId' })
  round: Round;
}
