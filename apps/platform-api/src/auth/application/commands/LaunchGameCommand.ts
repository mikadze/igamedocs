export interface LaunchGameCommand {
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
}
