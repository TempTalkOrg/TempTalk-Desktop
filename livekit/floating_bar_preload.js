/* global window */

const { ipcRenderer } = require('electron');
const url = require('url');
const i18n = require('../js/modules/i18n');

const config = url.parse(window.location.toString(), true).query;
const { locale } = config;
const localeMessages = ipcRenderer.sendSync('locale-data');

window.getOurNumber = () => config.ourNumber;
window.getEnvironment = () => config.environment;
window.getVersion = () => config.version;

window.React = require('react');
window.ReactDOM = require('react-dom');
window.moment = require('moment');

window.i18n = i18n.setup(locale, localeMessages);

require('../js/logging');

window.hangup = () => {
  ipcRenderer.send('floating-bar-hangup');
};

window.setMuted = muted => {
  ipcRenderer.send('floating-bar-set-muted', muted);
};

window.backToCall = () => {
  ipcRenderer.send('show-call-window');
};

window.registerFloatingBarUpdateHandler = callback => {
  ipcRenderer.on('update-floating-bar', callback);

  return () => {
    ipcRenderer.removeListener('update-floating-bar', callback);
  };
};

window.openCountdownTimerPopup = () => {
  ipcRenderer.send('open-countdown-timer-popup');
};

function makeGetter(name) {
  return () =>
    new Promise((resolve, reject) => {
      ipcRenderer.once(`get-success-${name}`, (event, error, value) => {
        if (error) {
          return reject(error);
        }

        return resolve(value);
      });
      ipcRenderer.send(`get-${name}`);
    });
}

window.getGlobalConfig = makeGetter('global-config');

window.registerSendFrameHandler = handler => {
  ipcRenderer.on('sned-frame-to-floating-bar', handler);

  return () => {
    ipcRenderer.removeListener('sned-frame-to-floating-bar', handler);
  };
};

window.registerHideWindowHandler = handler => {
  ipcRenderer.on('hide-window', handler);

  return () => {
    ipcRenderer.removeListener('hide-window', handler);
  };
};

window.getFloatingBarView = () => {
  const { FloatingBar } = require('../ts/components/call/FloatingBar');
  return FloatingBar;
};
