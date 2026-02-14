import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT, exportSPKI, generateKeyPair } from 'jose';
import { JwtAuthGateway } from '@connection/infrastructure/JwtAuthGateway';

describe('JwtAuthGateway', () => {
  let privateKey: CryptoKey;
  let publicKeyPem: string;
  let gateway: JwtAuthGateway;

  beforeAll(async () => {
    const keyPair = await generateKeyPair('RS256');
    privateKey = keyPair.privateKey;
    publicKeyPem = await exportSPKI(keyPair.publicKey);
    gateway = new JwtAuthGateway(publicKeyPem);
  });

  async function signToken(
    claims: Record<string, unknown>,
    options?: { expiresIn?: string; algorithm?: string },
  ): Promise<string> {
    const jwt = new SignJWT(claims as any)
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt();

    if (options?.expiresIn) {
      jwt.setExpirationTime(options.expiresIn);
    } else {
      jwt.setExpirationTime('1h');
    }

    return jwt.sign(privateKey);
  }

  it('returns AuthPayload for a valid token', async () => {
    const token = await signToken({
      playerId: 'player-1',
      operatorId: 'operator-a',
    });

    const result = await gateway.verify(token);

    expect(result).toEqual({
      playerId: 'player-1',
      operatorId: 'operator-a',
    });
  });

  it('extracts playerId from sub claim as fallback', async () => {
    const token = await signToken({
      sub: 'player-from-sub',
      operatorId: 'operator-a',
    });

    const result = await gateway.verify(token);

    expect(result).toEqual({
      playerId: 'player-from-sub',
      operatorId: 'operator-a',
    });
  });

  it('prefers playerId claim over sub', async () => {
    const token = await signToken({
      playerId: 'explicit-player',
      sub: 'sub-player',
      operatorId: 'operator-a',
    });

    const result = await gateway.verify(token);

    expect(result?.playerId).toBe('explicit-player');
  });

  it('returns null for an expired token', async () => {
    const token = await signToken(
      { playerId: 'player-1', operatorId: 'operator-a' },
      { expiresIn: '-1s' },
    );

    const result = await gateway.verify(token);

    expect(result).toBeNull();
  });

  it('returns null for a malformed token', async () => {
    const result = await gateway.verify('not-a-jwt');
    expect(result).toBeNull();
  });

  it('returns null for an empty token', async () => {
    const result = await gateway.verify('');
    expect(result).toBeNull();
  });

  it('returns null when playerId and sub are both missing', async () => {
    const token = await signToken({ operatorId: 'operator-a' });

    const result = await gateway.verify(token);

    expect(result).toBeNull();
  });

  it('returns null when operatorId is missing', async () => {
    const token = await signToken({ playerId: 'player-1' });

    const result = await gateway.verify(token);

    expect(result).toBeNull();
  });

  it('returns null for a token signed with a different key', async () => {
    const otherKeyPair = await generateKeyPair('RS256');
    const token = await new SignJWT({
      playerId: 'player-1',
      operatorId: 'operator-a',
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setExpirationTime('1h')
      .sign(otherKeyPair.privateKey);

    const result = await gateway.verify(token);

    expect(result).toBeNull();
  });
});
