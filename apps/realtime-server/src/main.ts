import { loadConfig } from '@config/config.schema';
import { createTopics } from '@messaging/infrastructure/topics';

const { config } = loadConfig();
const topics = createTopics(config.operatorId);

console.log(
  `[RealtimeServer] Started for operator: ${config.operatorId} on port ${config.wsPort}`,
);
