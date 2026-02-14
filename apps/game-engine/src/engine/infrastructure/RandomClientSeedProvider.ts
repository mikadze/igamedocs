import { randomBytes } from 'crypto';
import { ClientSeedProvider } from '@engine/application/ports/ClientSeedProvider';

export class RandomClientSeedProvider implements ClientSeedProvider {
  next(): string {
    return randomBytes(32).toString('hex');
  }
}
