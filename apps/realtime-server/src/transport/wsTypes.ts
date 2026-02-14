import type { ConnectionId } from '@connection/domain/ConnectionId';
import type { TokenBucket } from '@transport/TokenBucket';

export interface WsData {
  connectionId: ConnectionId;
  playerId: string;
  operatorId: string;
  rateLimiter: TokenBucket;
  bufferedAmount?: number;
}
