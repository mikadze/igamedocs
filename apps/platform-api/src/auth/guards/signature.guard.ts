import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { SignatureService } from '../../crypto/signature.service';
import { DbService } from '../../db/db.service';
import { eq } from 'drizzle-orm';
import { operators } from '../../db/schema';

/**
 * Guard for Game API endpoints called by aggregators/operators.
 * Verifies RSA-SHA256 signature and IP whitelist.
 */
@Injectable()
export class SignatureGuard implements CanActivate {
  private readonly logger = new Logger(SignatureGuard.name);

  constructor(
    private readonly signatureService: SignatureService,
    private readonly db: DbService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Extract operator ID from body
    const operatorCode = request.body?.operator_id;
    if (!operatorCode) {
      throw new UnauthorizedException('Missing operator_id in request body');
    }

    // Look up operator config
    const operator = await this.db.drizzle
      .select()
      .from(operators)
      .where(eq(operators.code, String(operatorCode)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!operator || !operator.isActive) {
      throw new UnauthorizedException('Unknown or inactive operator');
    }

    // IP whitelist check
    const clientIp =
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.ip;
    const allowedIps = operator.allowedIps as string[];
    if (allowedIps.length > 0 && !allowedIps.includes(clientIp)) {
      this.logger.warn(
        `IP ${clientIp} not in whitelist for operator ${operator.code}`,
      );
      throw new UnauthorizedException('IP not whitelisted');
    }

    // Signature verification
    const signature =
      request.headers['x-signature'] ||
      request.headers['x-hub88-signature'] ||
      request.headers['x-aviatrix-signature'];

    if (!signature) {
      throw new UnauthorizedException('Missing signature header');
    }

    // Use raw body preserved by Fastify content type parser (main.ts)
    // to ensure deterministic signature verification.
    const rawBody: string =
      request.rawBody ?? JSON.stringify(request.body);

    const isValid = this.signatureService.verify(rawBody, signature, [
      operator.rsaPublicKey,
    ]);

    if (!isValid) {
      this.logger.warn(
        `Invalid signature from operator ${operator.code}`,
      );
      throw new UnauthorizedException('Invalid signature');
    }

    // Attach operator to request for downstream use
    request.operator = operator;
    return true;
  }
}
