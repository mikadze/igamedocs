import { SeedChain } from '@rng/domain/SeedChain';
import { ProvablyFair } from '@rng/domain/ProvablyFair';
import { ServerSeedProvider } from '@engine/application/ports/ServerSeedProvider';
import { Logger } from '@shared/ports/Logger';

export class RotatingSeedChainProvider implements ServerSeedProvider {
  private chain: SeedChain;

  constructor(
    private readonly chainLength: number,
    private readonly logger: Logger,
  ) {
    const terminalSeed = ProvablyFair.generateServerSeed();
    this.chain = new SeedChain(terminalSeed, chainLength);
    this.logger.warn('Seed chain initialized', {
      chainHash: this.chain.peek(),
      chainLength,
    });
  }

  next(): string {
    if (this.chain.remaining === 0) {
      this.rotate();
    }
    return this.chain.next();
  }

  private rotate(): void {
    const terminalSeed = ProvablyFair.generateServerSeed();
    this.chain = new SeedChain(terminalSeed, this.chainLength);
    this.logger.warn('Seed chain rotated', {
      chainHash: this.chain.peek(),
      chainLength: this.chainLength,
    });
  }
}
