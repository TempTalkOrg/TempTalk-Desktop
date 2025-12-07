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

window.getIncomingCallInfo = () => {
  return {
    caller: config.caller,
    isPrivate: config.isPrivate === 'true',
    roomName: config.roomName,
    roomId: config.roomId,
    groupId: config.groupId,
    number: config.number,
    emk: config.emk,
    publicKey: config.publicKey,
    username: config.username,
    password: config.password,
    type: config.type,
    deviceId: config.deviceId,
    ourName: config.ourName,
    serviceUrls: config.serviceUrls,
    criticalAlert: config.criticalAlert === 'true',
  };
};

require('../js/logging');

window.isCallingExist = async () =>
  await ipcRenderer.invoke('is-calling-exist');

window.acceptOrReject = (action, data) => {
  ipcRenderer.send('rtc-call-method', {
    event: action ? 'accept' : 'reject',
    data,
  });
};

window.wantCloseSelf = () => {
  return ipcRenderer.send('want-close-incoming-call');
};

window.joinCallFromIncoming = (caller, roomName, isPrivate, extraParams) => {
  ipcRenderer.send('join-call-from-incoming', {
    caller,
    roomName,
    isPrivate,
    ...extraParams,
  });
};

// 搜寻用户名称和头像
window.searchUser = userId => {
  ipcRenderer.send('search-user', userId);
};

window.registerSearchUser = fn => {
  ipcRenderer.on('search-user', (_, info) => {
    fn(info);
  });
};

window.changeTheme = fn => {
  ipcRenderer.on('set-theme-setting', (_, info) => {
    fn(info);
  });
};

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

window.getIncomingCallView = () => {
  const { IncomingCall } = require('../ts/components/call/IncomingCall');
  return IncomingCall;
};
