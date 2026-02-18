/* global window */
const { ipcRenderer } = require('electron');
const url = require('url');
const i18n = require('../js/modules/i18n');

const config = url.parse(window.location.toString(), true).query;
window.theme = config.theme;
window.systemTheme = config.systemTheme;

window.getEnvironment = () => config.environment;
window.getVersion = () => config.version;
window.getAppInstance = () => config.appInstance;

const getTempDataPath = () => config.tempDataPath;
const getUserDataPath = () => config.userDataPath;

const { locale } = config;
const localeMessages = ipcRenderer.sendSync('locale-data');
const Signal = require('../js/modules/signal');
const { copyImage } = require('../js/modules/copy_image');
const Attachments = require('../app/attachments');

require('../js/logging');

window.React = require('react');
window.ReactDOM = require('react-dom');
window._lodash = require('lodash');
window.filesize = require('filesize');
window.i18n = i18n.setup(locale, localeMessages);

window.Signal = Signal.setup({
  Attachments,
  userDataPath: getUserDataPath(),
  tempDataPath: getTempDataPath(),
  logger: window.log,
});

const { loadAttachmentData } = window.Signal.Migrations;

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

// 获取系统主题
window.getNativeSystemTheme = makeGetter('system-theme');

window.sendBrowserOpenUrl = link => {
  ipcRenderer.send('browser-open-url', { target: link });
};

window.ipcGetGlobalConfig = makeGetter('global-config');

window.onCopyImage = async attachment => {
  await copyImage(attachment, loadAttachmentData);
};

window.showImageGallery = ({ mediaFiles, selectedIndex }) => {
  ipcRenderer.send('show-image-gallery', { mediaFiles, selectedIndex });
};

window.downloadAttachment = async data => {
  return window.Signal.Types.Attachment.save({
    ...data,
    getAbsolutePath: window.Signal.Migrations.getAbsoluteAttachmentPath,
  });
};

window.showNotice = (type, message, expireTime) => {
  window.Signal.Util.showToastAtCenter(message, {
    duration: expireTime,
    type,
  });
};

window.noticeError = (message, expireTime) => {
  window.showNotice('error', message, expireTime);
};

window.openFileDefault = (attachment, messageId) => {
  const { path, fileName, contentType } = attachment;
  const absPath = window.Signal.Migrations.getAbsoluteAttachmentPath(path);
  ipcRenderer.send('open-file-default', {
    path,
    absPath,
    fileName,
    contentType,
    messageId,
  });
};

window.getMessageProps = async messageId => {
  return await ipcRenderer.invoke('get-message-props', messageId);
};

window.getCurrentTheme = () =>
  document.body.classList.contains('dark-theme') ? 'dark' : 'light';

window.closeWindow = () => {
  ipcRenderer.send('want-close-self');
};
