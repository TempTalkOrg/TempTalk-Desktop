import type { LoggerType } from '../../logger/types';
import { LogRepsonse } from '../sqlWorkers/types';

export function handleLog(
  logger: LoggerType,
  response: LogRepsonse,
  logTag?: string
) {
  const { level, args } = response;
  const tag = `Worker-${logTag || ''}`;

  if (args?.length) {
    logger[level](`[${tag}]:`, ...args);
  } else {
    logger[level](`[${tag}]: [Empty Log]`);
  }
}
