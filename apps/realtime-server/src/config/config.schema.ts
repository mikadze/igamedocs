import { z } from 'zod';
import { type RealtimeConfig } from './RealtimeConfig';

export const realtimeConfigSchema = z.object({
  OPERATOR_ID: z
    .string()
    .min(3, 'OPERATOR_ID must be at least 3 characters')
    .max(64, 'OPERATOR_ID must be at most 64 characters')
    .regex(
      /^[a-z][a-z0-9]+(-[a-z0-9]+)*$/,
      'OPERATOR_ID must be a lowercase slug (e.g. "operator-a")',
    ),

  WS_PORT: z.coerce
    .number()
    .int()
    .min(1024, 'WS_PORT must be >= 1024')
    .max(65535, 'WS_PORT must be <= 65535')
    .default(8080),

  NATS_URL: z
    .string()
    .regex(
      /^(nats|tls):\/\/[^\s]+$/,
      'NATS_URL must use nats:// or tls:// scheme',
    )
    .default('nats://localhost:4222'),

  JWT_PUBLIC_KEY: z
    .string({ error: 'JWT_PUBLIC_KEY is required' })
    .min(32, 'JWT_PUBLIC_KEY must be a valid PEM-encoded public key')
    .refine(
      (key) => key.includes('-----BEGIN PUBLIC KEY-----') || key.includes('-----BEGIN ED25519 PUBLIC KEY-----'),
      'JWT_PUBLIC_KEY must be a PEM-encoded RS256 or EdDSA public key (Realtime Server never holds the private key)',
    ),

  MAX_CONNECTIONS: z.coerce
    .number()
    .int()
    .positive('MAX_CONNECTIONS must be > 0')
    .default(10000),

  LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default('info'),

  ALLOWED_ORIGINS: z
    .string()
    .default('')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
});

export type RawRealtimeConfig = z.infer<typeof realtimeConfigSchema>;

/**
 * Validates environment variables and returns typed config objects.
 * Call once at boot. Throws with formatted error messages on failure.
 */
export function loadConfig(): {
  raw: RawRealtimeConfig;
  config: RealtimeConfig;
} {
  const result = realtimeConfigSchema.safeParse(process.env);

  if (!result.success) {
    const messages = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `[RealtimeConfig] Invalid environment variables:\n${messages}`,
    );
  }

  const raw = result.data;

  const config: RealtimeConfig = {
    operatorId: raw.OPERATOR_ID,
    wsPort: raw.WS_PORT,
    maxConnections: raw.MAX_CONNECTIONS,
    allowedOrigins: raw.ALLOWED_ORIGINS,
  };

  return { raw, config };
}
