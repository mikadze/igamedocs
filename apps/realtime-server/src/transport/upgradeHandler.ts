import type { AuthGateway } from '@connection/application/ports/AuthGateway';
import type { ConnectionStore } from '@connection/application/ports/ConnectionStore';
import { ConnectionId } from '@connection/domain/ConnectionId';
import { TokenBucket } from '@transport/TokenBucket';

export interface UpgradeHandlerDeps {
  readonly authGateway: AuthGateway;
  readonly connectionStore: ConnectionStore;
  readonly maxConnections: number;
  readonly allowedOrigins: string[];
}

export function extractToken(req: Request): string | null {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('token');
  if (fromQuery) return fromQuery;

  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

export async function handleUpgrade(
  req: Request,
  server: { upgrade(req: Request, options?: any): boolean },
  deps: UpgradeHandlerDeps,
): Promise<Response | undefined> {
  if (deps.allowedOrigins.length > 0) {
    const origin = req.headers.get('origin');
    if (!origin || !deps.allowedOrigins.includes(origin)) {
      return new Response('Forbidden', { status: 403 });
    }
  }

  if (deps.connectionStore.count() >= deps.maxConnections) {
    return new Response('Service Unavailable', { status: 503 });
  }

  const token = extractToken(req);
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }

  const auth = await deps.authGateway.verify(token);
  if (!auth) {
    return new Response('Unauthorized', { status: 401 });
  }

  const upgraded = server.upgrade(req, {
    data: {
      connectionId: ConnectionId.generate(),
      playerId: auth.playerId,
      operatorId: auth.operatorId,
      rateLimiter: new TokenBucket(20, 10),
    },
  });

  if (!upgraded) {
    return new Response('WebSocket upgrade failed', { status: 400 });
  }

  return undefined;
}
