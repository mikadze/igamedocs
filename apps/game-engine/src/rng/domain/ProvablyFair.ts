import { createHmac, createHash, randomBytes } from 'crypto';
import { CrashPoint } from '@engine/domain/CrashPoint';

export class ProvablyFair {
  static generateServerSeed(): string {
    return randomBytes(32).toString('hex');
  }

  static hashServerSeed(seed: string): string {
    return createHash('sha256').update(seed).digest('hex');
  }

  static calculateCrashPoint(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    houseEdgePercent: number,
  ): CrashPoint {
    const hmac = createHmac('sha512', serverSeed)
      .update(`${clientSeed}:${nonce}`)
      .digest('hex');

    // Take first 13 hex characters (52 bits)
    const h = parseInt(hmac.substring(0, 13), 16);
    const e = 2 ** 52;

    // Instant crash with probability ≈ houseEdgePercent%
    if (h % Math.floor(100 / houseEdgePercent) === 0) {
      return CrashPoint.of(1.0);
    }

    // Crash point via inverse CDF (house edge applied via instant crash only)
    const result = Math.floor((100 * e - h) / (e - h)) / 100;
    return CrashPoint.of(Math.max(1.0, result));
  }

  static verify(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    claimedPoint: number,
    houseEdgePercent: number,
  ): boolean {
    const calculated = ProvablyFair.calculateCrashPoint(
      serverSeed,
      clientSeed,
      nonce,
      houseEdgePercent,
    );
    return calculated.value === claimedPoint;
  }
}
