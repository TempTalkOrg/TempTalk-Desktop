/* global
  window,
  watermark,
  $,
*/

const { ipcRenderer } = require('electron');
const { app, getCurrentWindow } = require('@electron/remote');

const url = require('url');

const i18n = require('./js/modules/i18n');

const Attachments = require('./app/attachments');

const config = url.parse(window.location.toString(), true).query;
const { locale } = config;
const localeMessages = ipcRenderer.sendSync('locale-data');
window.filesize = require('filesize');
window._lodash = require('lodash');

window.theme = config.theme;
window.i18n = i18n.setup(locale, localeMessages);

window.getEnvironment = () => config.environment;
window.getVersion = () => config.version;
window.getAppInstance = () => config.appInstance;
window.systemTheme = config.systemTheme;

window.PROTO_ROOT = 'protos';
window.React = require('react');
window.ReactDOM = require('react-dom');
window.moment = require('moment');

require('./js/logging');
const Signal = require('./js/modules/signal');

window.moment.updateLocale(locale.toLowerCase(), {
  relativeTime: {
    s: window.i18n('timestamp_s'),
    m: window.i18n('timestamp_m'),
    h: window.i18n('timestamp_h'),
  },
});
window.moment.locale(locale.toLowerCase());

window.Signal = Signal.setup({
  Attachments,
  userDataPath: app.getPath('userData'),
  getRegionCode: () => window.storage.get('regionCode'),
  logger: window.log,
});

ipcRenderer.on('receive-keywords', (_, keywords, conversationId) => {
  window.keywords = keywords;
  window.conversationId = conversationId;
});

window.jumpMessage = info => {
  ipcRenderer.send('jump-message', info);
};

// only worked on windows
window.changeTitleBarOverlay = overlay => {
  getCurrentWindow()?.setTitleBarOverlay?.(overlay);
};

// 更改主题
window.changeTheme = fn => {
  ipcRenderer.on('set-theme-setting', (_, info) => {
    fn(info);
  });
};

// 设置水印
window.setupWaterMark = userNumber => {
  if (userNumber) {
    let user = userNumber.replace('+', '');
    if (user.indexOf('.') !== -1) {
      user = user.substr(0, user.indexOf('.'));
    }

    $('.simple_blind_watermark').remove();
    watermark({ watermark_txt: user });
    window.addEventListener('resize', () => {
      $('.simple_blind_watermark').remove();
      watermark({ watermark_txt: user });
    });
  }
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

window.ipcGetGlobalConfig = makeGetter('global-config');
