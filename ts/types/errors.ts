export function toLogFormat(error: unknown): string {
  let formatted = '';

  if (error && typeof error === 'object') {
    if (error instanceof Error && error.stack) {
      formatted = error.stack;
    } else if ('message' in error) {
      formatted = error.message as string;
    }

    if ('cause' in error) {
      formatted += `\nCaused by: ${String(error.cause)}`;
    }
  }

  if (!formatted) {
    try {
      formatted = JSON.stringify(error);
    } catch (error) {
      formatted = Object.prototype.toString.call(error);
    }
  }

  return formatted;
}
