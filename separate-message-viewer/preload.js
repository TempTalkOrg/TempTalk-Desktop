/* global window */
const { ipcRenderer } = require('electron');
const url = require('url');
const i18n = require('../js/modules/i18n');

const config = url.parse(window.location.toString(), true).query;
window.theme = config.theme;
window.systemTheme = config.systemTheme;
// eslint-disable-next-line no-console
const { locale } = config;
const localeMessages = ipcRenderer.sendSync('locale-data');

require('../js/logging');

window.React = require('react');
window.ReactDOM = require('react-dom');
window.i18n = i18n.setup(locale, localeMessages);

window.getSeparateMessageView = () => {
  const {
    SeparateMessageView,
  } = require('../ts/components/separateMessageView');
  return SeparateMessageView;
};

window.registerShowMessageInSeparateView = handler => {
  ipcRenderer.on('update-view-data', handler);

  return () => {
    ipcRenderer.removeListener('update-view-data', handler);
  };
};

// 更改主题
window.changeTheme = fn => {
  ipcRenderer.on('set-theme-setting', (_, info) => {
    fn(info);
  });
};

// 获取系统主题
window.getNativeSystemTheme = makeGetter('system-theme');

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

window.readConfidentialMessage = id => {
  ipcRenderer.send('read-confidential-message', id);
};

window.sendBrowserOpenUrl = link => {
  ipcRenderer.send('browser-open-url', { target: link });
};
