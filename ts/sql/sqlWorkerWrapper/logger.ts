import { LoggerType } from '../../logger/types';
import { LogRepsonse } from '../sqlWorkers/types';
import { format } from 'util';

export function handleLog(
  logger: LoggerType,
  response: LogRepsonse,
  logTag?: string
) {
  const { level, args } = response;
  const tag = `Worker-${logTag || ''}`;

  if (args?.length) {
    const first = args[0];
    const remains = args.slice(1);
    logger[level](`[${tag}]: ${format(first, ...remains)}`);
  } else {
    logger[level](`[${tag}]: [Empty Log]`);
  }
}
