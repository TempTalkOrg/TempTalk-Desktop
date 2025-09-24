//      toLogFormat :: Error -> String
exports.toLogFormat = error => {
  let formatted = '';

  if (error && typeof error === 'object') {
    if (error instanceof Error && error.stack) {
      formatted = error.stack;
    } else if ('message' in error) {
      formatted = error.message;
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
};
