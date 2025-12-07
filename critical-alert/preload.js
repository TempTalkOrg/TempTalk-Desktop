/* global window */

const url = require('url');
const config = url.parse(window.location.toString(), true).query;
const { locale } = config;

window.getEnvironment = () => config.environment;

window.React = require('react');
window.ReactDOM = require('react-dom');

const { ipcRenderer } = require('electron');
const i18n = require('../js/modules/i18n');

const localeMessages = ipcRenderer.sendSync('locale-data');
window._ = require('lodash');

window.theme = config.theme;
window.getVersion = () => config.version;
window.getTheme = () => config.theme;

window.systemTheme = config.systemTheme;

window.getMeetingVersion = () => 10;

require('../js/logging');

window.changeTheme = fn => {
  ipcRenderer.on('set-theme-setting', (_, info) => {
    fn(info);
  });
};

window.getConversationId = () => config.conversationId;
window.getFrom = () => config.from;

window.i18n = i18n.setup(locale, localeMessages);

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

window.getCriticalAlertView = () => {
  const { CriticalAlert } = require('../ts/components/CriticalAlert');
  return CriticalAlert;
};

window.connectConversation = conversationId => {
  ipcRenderer.send('jump-message', { conversationId });
  ipcRenderer.send('want-close-self');
};
