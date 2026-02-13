import { Injectable, Logger } from '@nestjs/common';
import { createSign, createVerify } from 'node:crypto';

@Injectable()
export class SignatureService {
  private readonly logger = new Logger(SignatureService.name);

  /**
   * Sign a request body with Aviatrix's RSA private key.
   * Used on every outgoing wallet API call.
   */
  sign(body: string, privateKey: string): string {
    const signer = createSign('RSA-SHA256');
    signer.update(body);
    signer.end();
    return signer.sign(privateKey, 'base64');
  }

  /**
   * Verify an incoming request signature using the operator's RSA public key.
   * Supports key rotation: accepts an array of public keys (old + new during rotation window).
   */
  verify(body: string, signature: string, publicKeys: string[]): boolean {
    for (const publicKey of publicKeys) {
      try {
        const verifier = createVerify('RSA-SHA256');
        verifier.update(body);
        verifier.end();
        if (verifier.verify(publicKey, signature, 'base64')) {
          return true;
        }
      } catch (err) {
        this.logger.warn(`Signature verification failed with key: ${err}`);
      }
    }
    return false;
  }
}
