import { get, has } from 'lodash';

export function formatError(error: unknown) {
  if (error instanceof Error && error.stack) {
    return error.stack;
  }

  if (has(error, 'message')) {
    return get(error, 'message');
  }

  let jsonStr = undefined;
  try {
    jsonStr = JSON.stringify(error);
  } catch (error) {
    jsonStr = undefined;
  }

  return String(jsonStr);
}

export function logSeqId(id: string | number) {
  return 's' + id;
}

const MIN_TRACED_DURATION = 10;

export function shouldTrace(duration: number) {
  return duration - MIN_TRACED_DURATION > 0;
}
