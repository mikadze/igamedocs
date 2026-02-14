import { Injectable, Logger, OnModuleDestroy, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { SignatureService } from '../../crypto/signature.service';
import { operators } from '../../db/schema';
import { WalletAdapter } from '../interfaces/wallet-adapter.interface';
import { GenericSeamlessAdapter } from './generic-seamless.adapter';

/**
 * Resolves an operator ID to the correct WalletAdapter implementation.
 * Caches adapter instances per operator (connection pools are reused).
 */
@Injectable()
export class AdapterFactory implements OnModuleDestroy {
  private readonly logger = new Logger(AdapterFactory.name);
  private readonly adapters = new Map<string, GenericSeamlessAdapter>();
  private readonly privateKey: string;

  constructor(
    private readonly db: DbService,
    private readonly signatureService: SignatureService,
    private readonly config: ConfigService,
  ) {
    const key = this.config.get<string>('AVIATRIX_PRIVATE_KEY');
    const isProduction =
      this.config.get<string>('NODE_ENV') === 'production';

    if (!key && isProduction) {
      throw new Error(
        'AVIATRIX_PRIVATE_KEY must be set in production.',
      );
    }

    this.privateKey = key ?? 'dev-private-key-placeholder';

    if (!key) {
      this.logger.warn(
        'AVIATRIX_PRIVATE_KEY not set — using dev placeholder.',
      );
    }
  }

  async getAdapter(operatorId: string): Promise<WalletAdapter> {
    const cached = this.adapters.get(operatorId);
    if (cached) return cached;

    const operator = await this.db.drizzle
      .select()
      .from(operators)
      .where(eq(operators.id, operatorId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!operator) {
      throw new NotFoundException(`Operator not found: ${operatorId}`);
    }

    // TODO: switch on operator.code for specific adapter implementations
    // e.g. case 'hub88': return new Hub88Adapter(...)

    const adapter = new GenericSeamlessAdapter(
      {
        walletBaseUrl: operator.walletBaseUrl,
        aviatrixPrivateKey: this.privateKey,
      },
      this.signatureService,
    );

    this.adapters.set(operatorId, adapter);
    this.logger.log(
      `Created wallet adapter for operator ${operator.code} → ${operator.walletBaseUrl}`,
    );

    return adapter;
  }

  async onModuleDestroy() {
    const destroyPromises = Array.from(this.adapters.values()).map((adapter) =>
      adapter.destroy().catch((err) =>
        this.logger.error(`Failed to destroy adapter: ${err}`),
      ),
    );
    await Promise.all(destroyPromises);
    this.adapters.clear();
    this.logger.log('All wallet adapter pools destroyed');
  }
}
