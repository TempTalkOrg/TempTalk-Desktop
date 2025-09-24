const electron = require('electron');

const Errors = require('../js/modules/types/errors');

const { app, dialog, clipboard } = electron;
const { redactAll } = require('../js/modules/privacy');

// We use hard-coded strings until we're able to update these strings from the locale.
let quitText = 'Quit';
let copyErrorAndQuitText = 'Copy error and quit';

function handleError(prefix, error) {
  const formattedError = Errors.toLogFormat(error);

  console.error(`${prefix}:`, formattedError);

  const redactedError = redactAll(formattedError);

  if (app.isReady()) {
    // title field is not shown on macOS, so we don't use it
    const buttonIndex = dialog.showMessageBoxSync({
      buttons: [quitText, copyErrorAndQuitText],
      defaultId: 0,
      detail: redactedError,
      message: prefix,
      noLink: true,
      type: 'error',
    });

    if (buttonIndex === 1) {
      clipboard.writeText(`${prefix}\n\n${redactedError}`);
    }
  } else {
    dialog.showErrorBox(prefix, redactedError);
  }

  app.exit(1);
}

exports.updateLocale = messages => {
  quitText = messages.quit.message;
  copyErrorAndQuitText = messages.copyErrorAndQuit.message;
};

exports.addHandler = () => {
  app.on('render-process-gone', (_event, webContents, details) => {
    const { reason, exitCode } = details;

    if (reason === 'clean-exit') {
      return;
    }

    console.log(
      `Render process (${webContents.getTitle()}) is gone,` +
        ` Reason: ${reason}, Exit Code: ${exitCode}`
    );
  });

  app.on('child-process-gone', (_event, details) => {
    const { type, name, serviceName, reason, exitCode } = details;

    if (reason === 'clean-exit') {
      return;
    }

    console.log(
      `Children process (${type}-${name}-${serviceName}) is gone,` +
        ` Reason: ${reason}, Exit Code: ${exitCode}`
    );
  });

  process.on('uncaughtException', error => {
    handleError('Unhandled Error', error);
  });

  process.on('unhandledRejection', error => {
    handleError('Unhandled Promise Rejection', error);
  });
};
