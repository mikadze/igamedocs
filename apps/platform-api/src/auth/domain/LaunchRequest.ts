import { InvalidLaunchRequestError } from '@shared/kernel/DomainError';

export class LaunchRequest {
  readonly user: string;
  readonly token: string;
  readonly currency: string;
  readonly operatorId: string;
  readonly gameCode: string;
  readonly platform: string;
  readonly lang: string;
  readonly lobbyUrl: string;
  readonly depositUrl?: string;
  readonly country?: string;
  readonly ip?: string;

  constructor(params: {
    user: string;
    token: string;
    currency: string;
    operatorId: string;
    gameCode: string;
    platform: string;
    lang: string;
    lobbyUrl: string;
    depositUrl?: string;
    country?: string;
    ip?: string;
  }) {
    if (params.currency === 'XXX') {
      throw new InvalidLaunchRequestError('Demo mode is not supported (currency XXX)');
    }
    if (!params.user || params.user.trim().length === 0) {
      throw new InvalidLaunchRequestError('user is required');
    }
    if (!params.token || params.token.trim().length === 0) {
      throw new InvalidLaunchRequestError('token is required');
    }
    if (!params.currency || params.currency.length !== 3) {
      throw new InvalidLaunchRequestError('currency must be a 3-letter ISO code');
    }
    if (!params.operatorId) {
      throw new InvalidLaunchRequestError('operatorId is required');
    }
    if (!params.gameCode) {
      throw new InvalidLaunchRequestError('gameCode is required');
    }
    if (!params.lobbyUrl) {
      throw new InvalidLaunchRequestError('lobbyUrl is required');
    }

    this.user = params.user;
    this.token = params.token;
    this.currency = params.currency;
    this.operatorId = params.operatorId;
    this.gameCode = params.gameCode;
    this.platform = params.platform;
    this.lang = params.lang;
    this.lobbyUrl = params.lobbyUrl;
    this.depositUrl = params.depositUrl;
    this.country = params.country;
    this.ip = params.ip;
  }

  toJSON(): Record<string, unknown> {
    return {
      user: this.user,
      token: '[REDACTED]',
      currency: this.currency,
      operatorId: this.operatorId,
      gameCode: this.gameCode,
      platform: this.platform,
      lang: this.lang,
      lobbyUrl: this.lobbyUrl,
      depositUrl: this.depositUrl,
      country: this.country,
      ip: this.ip,
    };
  }
}
