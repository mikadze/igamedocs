export interface RealtimeConfig {
  operatorId: string;
  wsPort: number;
  maxConnections: number;
  allowedOrigins: string[];
}
