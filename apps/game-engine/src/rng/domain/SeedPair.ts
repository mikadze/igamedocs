import { InvalidSeedError } from '@shared/kernel/DomainError';

export class SeedPair {
  readonly serverSeed: string;
  readonly clientSeed: string;

  constructor(serverSeed: string, clientSeed: string) {
    if (!/^[0-9a-f]{64}$/i.test(serverSeed)) {
      throw new InvalidSeedError('Server seed must be a 64-character hex string');
    }
    
    if (!clientSeed || clientSeed.trim().length === 0) {
      throw new InvalidSeedError('Client seed must be non-empty');
    }

    this.serverSeed = serverSeed;
    this.clientSeed = clientSeed;
    
    Object.freeze(this);
  }
}
