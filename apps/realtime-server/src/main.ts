import { loadConfig } from '@config/config.schema';

const { config, topics } = loadConfig();

console.log(
  `[RealtimeServer] Started for operator: ${config.operatorId} on port ${config.wsPort}`,
);
