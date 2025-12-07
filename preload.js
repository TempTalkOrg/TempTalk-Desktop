/* global Whisper: false */
/* global window: false */

const process = require('process');
const electron = require('electron');
const path = require('path');
const fse = require('fs-extra');
const semver = require('semver');
window._lodash = require('lodash');
const { isFileRegular } = require('./ts/util/isFileRegular');
const MIME = require('./ts/types/MIME');
const sanitize = require('sanitize-filename');

window.MESSAGE_MINIMUM_SUPPORTED_VERSION = 2;
window.MESSAGE_CURRENT_VERSION = 2;

const { platform, arch } = process;
window.libCryptoClient = require(`./lib-crypto-client/${platform}/${arch}`);

const { app, getCurrentWindow, dialog } = require('@electron/remote');
window.getLocalLanguage = () => app.getLocale();

const {
  globalConfig: globalConfigDefault,
  globalConfigURLs: globalConfigURLsDefault,
} = require('./config/default.json');
const {
  globalConfig: globalConfigProduction,
  globalConfigURLs: globalConfigURLsProduction,
} = require('./config/production.json');

window.globalConfig = globalConfigProduction || globalConfigDefault;
window.globalConfigURLs = globalConfigURLsProduction || globalConfigURLsDefault;

window.PROTO_ROOT = 'protos';
const config = require('url').parse(window.location.toString(), true).query;
if (config.environment === 'development') {
  const {
    globalConfig: globalConfigDev,
    globalConfigURLs: globalConfigURLsDev,
  } = require('./config/development.json');
  window.globalConfig = globalConfigDev || globalConfigDefault;
  window.globalConfigURLs = globalConfigURLsDev || globalConfigURLsDefault;
}

let title = config.name;
if (config.environment !== 'production') {
  title += ` - ${config.environment}`;
}
if (config.appInstance) {
  title += ` - ${config.appInstance}`;
}

window.platform = process.platform;
window.getTitle = () => title;
window.getEnvironment = () => config.environment;
window.getAppInstance = () => config.appInstance;
window.getVersion = () => config.version;
window.getExpiration = () => config.buildExpiration;
window.getNodeVersion = () => config.node_version;
window.getHostName = () => config.hostname;
window.getSystemTheme = () => config.systemTheme;
window.getRunningUnderArch = () => config.runningUnderArch;
window.isInsiderUpdate = () => config.insiderUpdateEnabled === 'true';
window.getFlavorId = () => config.flavorId;

window.copyText = async text => {
  await navigator.clipboard.writeText(text).catch(() => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.setAttribute('value', text);
    input.select();
    if (document.execCommand('copy')) {
      document.execCommand('copy');
    }
    document.body.removeChild(input);
  });
};

window.isBeforeVersion = (toCheck, baseVersion) => {
  try {
    return semver.lt(toCheck, baseVersion);
  } catch (error) {
    window.log.error(
      `isBeforeVersion error: toCheck: ${toCheck}, baseVersion: ${baseVersion}`,
      error && error.stack ? error.stack : error
    );
    return true;
  }
};

const ipc = electron.ipcRenderer;
const localeMessages = ipc.sendSync('locale-data');

window.noticeInfo = (message, expireTime) => {
  window.showNotice('info', message, expireTime);
};
window.noticeError = (message, expireTime) => {
  window.showNotice('error', message, expireTime);
};
window.noticeSuccess = (message, expireTime) => {
  window.showNotice('success', message, expireTime);
};
window.noticeWarning = (message, expireTime) => {
  window.showNotice('warning', message, expireTime);
};
window.noticeWithoutType = (message, expireTime) => {
  window.showNotice('none-type', message, expireTime);
};

window.showNotice = (type, message, expireTime) => {
  const obj = { type, message, expireTime };
  const ev = new CustomEvent('main-menu-show-notice', { detail: obj });
  window.dispatchEvent(ev);
};

window.setBadgeCount = (redCount, greyCount) => {
  ipc.send('set-badge-count', redCount);
  const ev = new CustomEvent('main-header-set-badge-count', {
    detail: {
      redCount,
      greyCount,
    },
  });
  window.dispatchEvent(ev);
};
window.queryBadgeCount = () => ipc.send('query-badge-count');
ipc.on('query-badge-count', (_, count) => {
  const ev = new CustomEvent('main-header-set-badge-count', { detail: count });
  window.dispatchEvent(ev);
});

window.ipcFreshWebApiUrlCache = info => ipc.send('freshWebApiUrlCache', info);
window.badSelfSignedCert = host => ipc.sendSync('bad-self-signed-cert', host);

window.sendSearchUser = info => {
  ipc.send('search-user-reply', info);
};
window.handleOnCopy = () => {
  ipc.send('copy');
};
window.registerSearchUser = fn => {
  if (!fn) {
    ipc.removeAllListeners('search-user');
  } else {
    ipc.on('search-user', (_, info) => {
      fn(info);
    });
  }
};

ipc.on('unlink-current-device', async () => {
  try {
    const result = await window.getAccountManager().unlinkCurrentDevice();
    window.log.info('unlink-current-device result:', result);
  } catch (error) {
    window.log.error(
      'preload.js: unlink-current-device failed:',
      error && error.stack ? error.stack : error
    );

    dialog.showErrorBox('Logout Warning', 'Log out from server failed!');
  } finally {
    // always clear configuration data
    Whisper.events.trigger('manual-logout', {
      manualLogout: true,
      error: 'manual logout',
    });
  }
});

// We never do these in our code, so we'll prevent it everywhere
window.open = () => null;
// eslint-disable-next-line no-eval, no-multi-assign
window.eval = global.eval = () => null;

window.drawAttention = () => {
  window.log.info('draw attention');
  ipc.send('draw-attention');
};
window.showWindow = () => {
  window.log.info('show window');
  ipc.send('show-window');
};

window.setAutoHideMenuBar = autoHide =>
  ipc.send('set-auto-hide-menu-bar', autoHide);

window.setMenuBarVisibility = visibility =>
  ipc.send('set-menu-bar-visibility', visibility);

window.restart = () => {
  window.log.info('restart');
  ipc.send('restart');
};

window.forceUpdateAlert = () => {
  const options = {
    type: 'error',
    buttons: [window.i18n('downloadTooltip')],
    message: window.i18n('forceUpdateLatestVersion'),
    detail: '',
  };

  return dialog.showMessageBox(getCurrentWindow(), options);
};

window.wantQuit = () => {
  window.log.info('want quit!');
  app.quit();
};

window.relaunch = () => {
  window.log.info('relaunching ...');
  ipc.send('restart');
};

window.closeAbout = () => ipc.send('close-about');
window.readyForUpdates = () => ipc.send('ready-for-updates');

window.updateTrayIcon = unreadCount =>
  ipc.send('update-tray-icon', unreadCount);

ipc.on('set-up-as-new-device', () => {
  Whisper.events.trigger('setupAsNewDevice');
});

ipc.on('set-up-as-standalone', () => {
  Whisper.events.trigger('setupAsStandalone');
});

ipc.on('show-update-button', (_, detail) => {
  const event = new CustomEvent('event-show-update-button', { detail });
  window.dispatchEvent(event);
});

window.updateWillReboot = () => {
  ipc.send('update-will-reboot');
};

ipc.on('meeting-get-all-contacts', () => {
  if (!window.ConversationController) {
    ipc.send('reply-meeting-get-all-contacts', []);
    return;
  }
  let info;
  try {
    info = window.ConversationController.getAllPrivateConversations();
    info = info.models.map(model => {
      const item = model.cachedProps;
      if (item.type === 'direct') {
        return {
          id: item.id,
          avatarPath: item.avatarPath,
          name: item.name || item.id,
        };
      }
      return undefined;
    });
    info = info.filter(item => item);
  } catch (e) {
    window.info(
      'preload.js meeting-get-all-contacts exception:',
      JSON.stringify(e)
    );
  }

  if (info) {
    ipc.send('reply-meeting-get-all-contacts', info);
  } else {
    ipc.send('reply-meeting-get-all-contacts', []);
  }
});

ipc.on('get-group-members', (_, groupId) => {
  if (!window.ConversationController) {
    ipc.send('reply-get-group-members', []);
    return;
  }

  let members = [];

  const conversation = window.ConversationController.get(groupId);
  if (conversation) {
    members = conversation.get('members');
  }

  ipc.send('reply-get-group-members', members);
});

// Settings-related events
window.showAbout = () => ipc.send('show-about');
window.manualCheckForUpdates = () => ipc.send('manual-check-for-updates');
window.showPermissionsPopup = () => ipc.send('show-permissions-popup');

// return NodeJs Buffer
window.digestMD5 = arrayBuffer => {
  const md5 = require('crypto').createHash('md5');
  return md5.update(Buffer.from(arrayBuffer)).digest();
};

ipc.on('jump-message', (_, info) => {
  const { conversationId, messageId, recentConversationSwitch, type } = info;
  if (conversationId) {
    // 关闭名片对话框
    window.dispatchEvent(new Event('event-close-user-profile'));

    Whisper.events.trigger(
      'showConversation',
      conversationId,
      messageId,
      recentConversationSwitch,
      type
    );
    const myEvent = new Event('event-toggle-switch-chat');
    window.dispatchEvent(myEvent);
  }
});

ipc.on('event-open-user-setting', () => {
  const myEvent = new Event('event-open-user-setting');
  window.dispatchEvent(myEvent);
});

ipc.on('open-profile', (_, uid, pos) => {
  // 检查此会话是否存在
  const c = window.ConversationController.get(uid);
  if (!c) {
    window.noticeError(window.i18n('number_not_register_error'));
    return;
  }
  const ev = new CustomEvent('open-profile-with-position', {
    detail: { uid, pos },
  });
  window.dispatchEvent(ev);
});

ipc.on('add-dark-overlay', () => {
  const { addDarkOverlay } = window.Events;
  if (addDarkOverlay) {
    addDarkOverlay();
  }
});
ipc.on('remove-dark-overlay', () => {
  const { removeDarkOverlay } = window.Events;
  if (removeDarkOverlay) {
    removeDarkOverlay();
  }
});

window.sendBrowserOpenUrl = link => {
  ipc.send('browser-open-url', { target: link });
};

window.showNewGroupWindow = () => {
  // ipc.send('show-group-editor', 'new-group');
  const ev = new CustomEvent('global-components-members-change', {
    detail: { type: 'new-group' },
  });
  window.dispatchEvent(ev);
};

window.showImageGallery = ({ mediaFiles, selectedIndex }) => {
  ipc.send('show-image-gallery', { mediaFiles, selectedIndex });
};

window.quickCreateGroup = id => {
  const ev = new CustomEvent('global-components-members-change', {
    detail: { type: 'quick-group', id },
  });
  window.dispatchEvent(ev);
};

window.quickCreateGroupFromGroup = (name, groupId) => {
  const ev = new CustomEvent('global-components-members-change', {
    detail: { type: 'group-quick-group', name, groupId },
  });
  window.dispatchEvent(ev);
};

window.showAddGroupMembersWindow = groupId => {
  // ipc.send('show-group-editor', 'add-group-members', groupId);
  const ev = new CustomEvent('global-components-members-change', {
    detail: { type: 'add-group-members', groupId },
  });
  window.dispatchEvent(ev);
};

window.showRemoveGroupMembersWindow = groupId => {
  // ipc.send('show-group-editor', 'remove-group-members', groupId);
  const ev = new CustomEvent('global-components-members-change', {
    detail: { type: 'remove-group-members', groupId },
  });
  window.dispatchEvent(ev);
};

window.showAddGroupAdminsWindow = groupId => {
  // ipc.send('show-group-editor', 'add-group-members', groupId);
  const ev = new CustomEvent('global-components-members-change', {
    detail: { type: 'add-group-admins', groupId },
  });
  window.dispatchEvent(ev);
};

window.showRemoveGroupAdminsWindow = groupId => {
  // ipc.send('show-group-editor', 'add-group-members', groupId);
  const ev = new CustomEvent('global-components-members-change', {
    detail: { type: 'remove-group-admins', groupId },
  });
  window.dispatchEvent(ev);
};

// window.showGroupEditorWindow = (options) => {
//   ipc.send('show-group-editor', options);
// }

window.sendOperationResult = (operation, targetWinId, result) => {
  if (!targetWinId) {
    return;
  }
  const { BrowserWindow } = require('@electron/remote');
  const targetWin = BrowserWindow.fromId(targetWinId);

  if (targetWin) {
    targetWin.webContents.send(operation, result);
  } else {
    window.log.info('window does not exists for window ID:', targetWinId);
  }
};

// window.sendGroupOperationResult = (targetWinId, result) => {
//   sendOperationResult('group-operation-result', targetWinId, result);
// }

window.sendEditResult = (targetWinId, result) => {
  sendOperationResult('edit-result', targetWinId, result);
};

// create or edit group
// this channel usually triggerred by group editor window.
// and this listener usually transfer it to the whisper events
// to make networking and interfacing operations
ipc.on('create-or-edit-group', (e, fromWinId, editInfo) => {
  Whisper.events.trigger('create-or-edit-group', fromWinId, editInfo);
});

window.showCallWindow = () => {
  ipc.send('show-call-window');
};

window.openFileDefault = async (absPath, fileName, contentType) => {
  fileName = sanitize(fileName || '');

  let extension = '';
  if (fileName && fileName.indexOf('.') >= 0) {
    const lastPeriod = fileName.lastIndexOf('.');
    extension = fileName.slice(lastPeriod + 1);
  }

  const ext = isFileRegular(extension);
  const cacheDir = path.join(app.getPath('userData'), 'tempFiles/');
  const newFileName = path.join(cacheDir, fileName);
  try {
    await fse.ensureDir(cacheDir);
    await fse.copy(absPath, newFileName);
    if (
      (!ext || ext === 'zip') &&
      !MIME.isImage(contentType) &&
      !MIME.isVideo(contentType)
    ) {
      // https://github.com/electron/electron/issues/38540
      ipcRenderer.send('ipc_showItemInFolder', newFileName);
      // await shell.showItemInFolder(newFileName);
    } else {
      ipcRenderer.send('ipc_openPath', newFileName);
      // await shell.openPath(newFileName);
    }
  } catch (error) {
    window.log.error('preload window.openFileDefault error:', error);
    window.noticeError(`Open ${fileName} failed!`);
  }
};

ipc.on('open-file-default', (e, absPath, fileName, contentType) => {
  window.openFileDefault(absPath, fileName, contentType);
});

ipc.on('power-monitor-resume', () => {
  Whisper.events.trigger('power-monitor-resume');
});

installGetter('global-config', 'getGlobalConfig');

installGetter('device-name', 'getDeviceName');

installGetter('theme-setting', 'getThemeSetting');
installSetter('theme-setting', 'setThemeSetting');
// installGetter('hide-menu-bar', 'getHideMenuBar');
// installSetter('hide-menu-bar', 'setHideMenuBar');

installGetter('notification-setting', 'getNotificationSetting');
installSetter('notification-setting', 'setNotificationSetting');
installGetter('audio-notification', 'getAudioNotification');
installSetter('audio-notification', 'setAudioNotification');

installGetter('spell-check', 'getSpellCheck');
installSetter('spell-check', 'setSpellCheck');

installGetter('quit-topic-setting', 'getQuitTopicSetting');
installSetter('quit-topic-setting', 'setQuitTopicSetting');

window.getThemeSetting = makeSettingGetter('theme-setting');
window.setThemeSetting = makeSettingSetter('theme-setting');
window.getNativeSystemTheme = makeSettingGetter('system-theme');

window.getNotificationSetting = makeSettingGetter('notification-setting');
window.setNotificationSetting = makeSettingSetter('notification-setting');
window.getAudioNotification = makeSettingGetter('audio-notification');
window.setAudioNotification = makeSettingSetter('audio-notification');

window.getSpellCheck = makeSettingGetter('spell-check');
window.setSpellCheck = makeSettingSetter('spell-check');

window.getQuitTopicSetting = makeSettingGetter('quit-topic-setting');
window.setQuitTopicSetting = makeSettingSetter('quit-topic-setting');

window.getMediaPermissions = makeSettingGetter('media-permissions');
window.setMediaPermissions = makeSettingSetter('media-permissions');

window.getDisableHardwareAcceleration = makeSettingGetter(
  'disable-hardware-acceleration'
);
window.setDisableHardwareAcceleration = v => {
  makeSettingSetter('disable-hardware-acceleration')(v);
};
window.getOriginalDisableHardwareAcceleration = makeSettingGetter(
  'original-disable-hardware-acceleration'
);

window.setLanguage = v => {
  makeSettingSetter('user-language')(v);
};
window.getLanguage = makeSettingGetter('language');
window.getOriginalLanguage = makeSettingGetter('original-language');

function makeSettingGetter(name) {
  return () =>
    new Promise((resolve, reject) => {
      ipc.once(`get-success-${name}`, (event, error, value) => {
        if (error) {
          return reject(error);
        }

        return resolve(value);
      });
      ipc.send(`get-${name}`);
    });
}

function makeSettingSetter(name) {
  return value =>
    new Promise((resolve, reject) => {
      ipc.once(`set-success-${name}`, (event, error) => {
        if (error) {
          return reject(error);
        }

        return resolve();
      });
      ipc.send(`set-${name}`, value);
    });
}

installGetter('is-primary', 'isPrimary');

window.deleteAllData = () => ipc.send('delete-all-data');

ipc.on('get-ready-for-shutdown', async () => {
  const { shutdown } = window.Events || {};
  if (!shutdown) {
    window.log.error('preload shutdown handler: shutdown method not found');
    ipc.send('now-ready-for-shutdown');
    return;
  }

  try {
    await shutdown();
    ipc.send('now-ready-for-shutdown');
  } catch (error) {
    ipc.send(
      'now-ready-for-shutdown',
      error && error.stack ? error.stack : error
    );
  }
});

function installGetter(name, functionName) {
  ipc.on(`get-${name}`, async () => {
    const getFn = window.Events[functionName];
    if (!getFn) {
      ipc.send(
        `get-success-${name}`,
        `installGetter: ${functionName} not found for event ${name}`
      );
      return;
    }
    try {
      ipc.send(`get-success-${name}`, null, await getFn());
    } catch (error) {
      ipc.send(
        `get-success-${name}`,
        error && error.stack ? error.stack : error
      );
    }
  });
}

function installSetter(name, functionName) {
  ipc.on(`set-${name}`, async (_event, value) => {
    const setFn = window.Events[functionName];
    if (!setFn) {
      ipc.send(
        `set-success-${name}`,
        `installSetter: ${functionName} not found for event ${name}`
      );
      return;
    }
    try {
      await setFn(value);
      ipc.send(`set-success-${name}`);
    } catch (error) {
      ipc.send(
        `set-success-${name}`,
        error && error.stack ? error.stack : error
      );
    }
  });
}

function makeGetter(name) {
  return () =>
    new Promise((resolve, reject) => {
      ipc.once(`get-success-${name}`, (event, error, value) => {
        if (error) {
          return reject(error);
        }

        if (name === 'system-theme') {
          window.systemTheme = value;
        }

        return resolve(value);
      });
      ipc.send(`get-${name}`);
    });
}

window.getNativeSystemTheme = makeGetter('system-theme');
window.addSetupMenuItems = () => ipc.send('add-setup-menu-items');
window.removeSetupMenuItems = () => ipc.send('remove-setup-menu-items');
window.storageReadyNotify = theme => ipc.send('storage-ready-notify', theme);

window.showLocalSearch = (keywords, conversationId) => {
  return ipc.send('show-local-search', keywords, conversationId);
};
window.jumpMessage = info => {
  ipc.send('jump-message', info);
};

// We pull these dependencies in now, from here, because they have Node.js dependencies

require('./js/logging');

if (config.proxyUrl) {
  window.log.info('Using provided proxy url');
}

window.nodeSetImmediate = setImmediate;

const { initialize: initializeWebAPI } = require('./js/modules/web_api');

window.WebAPI = initializeWebAPI({
  certificateAuthority: config.certificateAuthority,
  proxyUrl: config.proxyUrl,
  flavorId: window.getFlavorId(),
  insiderUpdate: window.isInsiderUpdate(),
});

// Linux seems to periodically let the event loop stop, so this is a global workaround
setInterval(() => {
  window.nodeSetImmediate(() => {});
}, 1000);

const { copyImage } = require('./js/modules/copy_image');
window.copyImage = copyImage;

window.dataURLToBlobSync = require('blueimp-canvas-to-blob');
window.filesize = require('filesize');
window.libphonenumber =
  require('google-libphonenumber').PhoneNumberUtil.getInstance();
window.libphonenumber.PhoneNumberFormat =
  require('google-libphonenumber').PhoneNumberFormat;
window.loadImage = require('blueimp-load-image');

({ v4: window.getGuid } = require('uuid'));

window.React = require('react');
window.ReactDOM = require('react-dom');
window.moment = require('moment');
window.PQueue = require('p-queue').default;
window.windowName = 'mainWindow';

const Signal = require('./js/modules/signal');
const i18n = require('./js/modules/i18n');
const Attachments = require('./app/attachments');

const { locale } = config;
window.i18n = i18n.setup(locale, localeMessages);
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

// Pulling these in separately since they access filesystem, electron
window.Signal.Logs = require('./js/modules/logs');

window.electronConfirm = async (
  message,
  okText,
  cancelText = window.i18n('cancel'),
  isWarning = false
) => {
  const okButton = 0;
  // const cancelButton = 1;

  const buttons = [okText || window.i18n('ok')];
  if (cancelText) {
    buttons.push(cancelText);
  }

  const newOptions = {
    type: isWarning ? 'warning' : 'question',
    buttons,
    message: message || 'Do you confirm continue?',
    defaultId: okButton,
  };

  const res = await dialog.showMessageBox(getCurrentWindow(), newOptions);
  return res.response === okButton;
};

// We pull this in last, because the native module involved appears to be sensitive to
//   /tmp mounted as noexec on Linux.
const { ipcRenderer } = require('electron');

if (config.environment === 'test') {
  /* eslint-disable global-require, import/no-extraneous-dependencies */
  window.test = {
    glob: require('glob'),
    fse: require('fs-extra'),
    tmp: require('tmp'),
    path: require('path'),
    basePath: __dirname,
    attachmentsPath: window.Signal.Migrations.attachmentsPath,
  };
  /* eslint-enable global-require, import/no-extraneous-dependencies */
}

// ###################### recent conversation switch ######################
const MAX_RECENT_LENGTH = 20;
let recentConversation = [];
let recentConversationCurrentIndex = 0;
window.getConversationSwitchStatus = () => {
  if (recentConversation?.length < 2) {
    noticeConversationSwitchEnabled(false, false);
    return;
  }
  return {
    goBackEnabled: recentConversationCurrentIndex > 0,
    goForwardEnabled:
      recentConversationCurrentIndex < recentConversation.length - 1,
  };
};
window.conversationJoinQueue = async cid => {
  const idv1 = window.Signal.ID.convertIdToV1(cid);
  // 点击的是当前的，直接返回即可
  if (recentConversation[recentConversationCurrentIndex] === idv1) {
    return;
  }
  const filter = recentConversation?.filter(id => id !== idv1) || [];
  if (filter.length >= MAX_RECENT_LENGTH) {
    filter.shift();
    filter.push(idv1);
  } else {
    filter.push(idv1);
  }
  recentConversation = [...filter];
  recentConversationCurrentIndex = filter.length - 1;
  noticeConversationSwitchEnabled(recentConversation.length >= 2, false);
};
window.conversationGoForward = () => {
  if (
    recentConversation?.length < 2 ||
    recentConversationCurrentIndex === recentConversation.length - 1
  ) {
    noticeConversationSwitchEnabled(false, false);
    return;
  }
  window.jumpMessage({
    conversationId: recentConversation[recentConversationCurrentIndex + 1],
    recentConversationSwitch: true,
  });
  recentConversationCurrentIndex += 1;
  noticeConversationSwitchEnabled(
    true,
    recentConversationCurrentIndex < recentConversation.length - 1
  );
};
window.conversationGoBack = () => {
  if (recentConversation?.length < 2 || recentConversationCurrentIndex === 0) {
    noticeConversationSwitchEnabled(false, false);
    return;
  }
  window.jumpMessage({
    conversationId: recentConversation[recentConversationCurrentIndex - 1],
    recentConversationSwitch: true,
  });
  recentConversationCurrentIndex -= 1;
  noticeConversationSwitchEnabled(recentConversationCurrentIndex > 0, true);
};
const noticeConversationSwitchEnabled = (goBackEnabled, goForwardEnabled) => {
  window.dispatchEvent(
    new CustomEvent('conversation-switch-enabled', {
      detail: { goBackEnabled, goForwardEnabled },
    })
  );
};
window.getCurrentOpenConversation = () => {
  if (!recentConversation || recentConversation.length === 0) {
    return null;
  }
  return recentConversation[recentConversationCurrentIndex];
};
// ###################### recent conversation switch ######################

window.cacheGlobalConfig = globalConfig => {
  if (!globalConfig) {
    return;
  }
  ipc.send('cache_globalConfig', globalConfig);
};

window.cacheGlobalPrivateContacts = privateContact => {
  ipc.send('cache_private_contact', privateContact);
};

ipc.on('query-user-by-inviteCode', async (_, pi) => {
  try {
    const { uid } = await textsecure.messaging.queryUserByInviteCode(pi);
    const { data } = (await textsecure.messaging.queryUserById([uid])) || {};
    const attributes = data?.contacts?.[0] || {};
    const conversation = await ConversationController.getOrCreateAndWait(
      uid,
      'private'
    );
    conversation.set({
      ...attributes,
    });
    await window.Signal.Data.updateConversation(conversation.attributes, {
      Conversation: Whisper.Conversation,
    });
    Whisper.events.trigger('showConversation', uid);
    const myEvent = new Event('event-toggle-switch-chat');
    window.dispatchEvent(myEvent);
  } catch (e) {
    console.log(e);
    alert(JSON.stringify(e));
  }
});

window.isDBLegacyInitilized = config.dbInitilized == 'true';

let dbInitilized = window.isDBLegacyInitilized;
window.hasDBInitialized = () => dbInitilized;

function makeIpcCall(name) {
  return params =>
    new Promise((resolve, reject) => {
      ipc.once(`ipc-call-success-${name}`, (event, error, value) => {
        if (error) {
          return reject(error);
        }

        return resolve(value);
      });
      ipc.send(`ipc-call-${name}`, params);
    });
}

const ipcSignParams = makeIpcCall('signParams');
const ipcInitDBWithSecret = makeIpcCall('initDBWithSecret');
const ipcNewSecrets = makeIpcCall('newSecrets');
const ipcGetSecretPublicKey = makeIpcCall('getSecretPublicKey');
const ipcConfirmSecrets = makeIpcCall('confirmSecrets');

class NoPermissionError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

class RateLimitExceededError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

class NotMatchedSecretError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

class InvalidKeyPairsError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

window.tryToInitDatabase = async () => {
  if (dbInitilized) {
    return;
  }

  let secretPublicKey = null;

  try {
    secretPublicKey = await ipcGetSecretPublicKey();
  } catch (error) {
    log.error('ipc get secret public key failed.', error);
  }

  if (!secretPublicKey) {
    log.error('no valid secret public key');
    throw new InvalidKeyPairsError('No valid secret public key');
  }

  let secretDBKey;

  try {
    const outerRequest = window.getOuterRequest();
    // get nonce for getSecret
    const nonce = await outerRequest.getNonceForSecretGet(secretPublicKey);

    let signature;
    try {
      // sign request params
      signature = await ipcSignParams(nonce);
    } catch (error) {
      log.error('ipc sign params failed', error);
      throw new InvalidKeyPairsError('Other errors when requesting secret');
    }

    // request secret db key
    secretDBKey = await outerRequest.getSecret(signature, nonce);
  } catch (error) {
    log.error('request secret db key error:', error);

    const { response, name, code } = error;
    const { API_STATUS } = window.Signal.Types.APIStatus;
    if (name === 'HTTPError' && code === 400) {
      switch (response?.status) {
        case API_STATUS.NoPermission:
          throw new NoPermissionError('Request secret was forbbiden');
        case API_STATUS.RateLimitExceeded:
          throw new RateLimitExceededError('Request rate limit exceeded');
        default:
          throw new Error('Request secret failed');
      }
    } else {
      if (error?.name === 'InvalidKeyPairsError') {
        throw error;
      }

      throw new Error('Request secret failed');
    }
  }

  try {
    dbInitilized = await ipcInitDBWithSecret(secretDBKey);
  } catch (error) {
    log.error('ipcInitDBWithSecret failed:', error);
    throw new NotMatchedSecretError('Secret is not matched with database');
  }
};

window.uploadSecretDBKey = async (deviceInfo, showMessageBeforeConfirm) => {
  let secretPublicKey = null;

  try {
    // generate secret keyPairs & new dbKey & secretText
    let secretText;
    ({ secretText, publicKey: secretPublicKey } = await ipcNewSecrets());

    const accountManager = window.getAccountManager();

    // get nonce before uploading
    const nonce = await accountManager.getNonceForSecretUpload(secretPublicKey);

    // construct plain text used for calculate signature
    // secret_text + nonce
    const signature = await ipcSignParams(`${secretText}${nonce}`);
    await accountManager.uploadSecret({
      secretText,
      nonce,
      signature,
      deviceInfo,
    });
  } catch (error) {
    log.error('uploadSecretDBKey error:', error);
    throw new Error('upload secret failed');
  }

  if (typeof showMessageBeforeConfirm === 'function') {
    showMessageBeforeConfirm();
  }

  // confirm secret key pairs if upload successfully
  try {
    await ipcConfirmSecrets(secretPublicKey);
  } catch (error) {
    log.error('saveSecretDBKey error:', error);
    throw new Error('confirm secret failed');
  }
};

ipcRenderer.on('is-caller-directory-user', (_event, callerId) => {
  const conversation = window.ConversationController?.get(callerId);

  ipcRenderer.send(
    'result-is-caller-directory-user',
    !!conversation?.isDirectoryUser()
  );
});

window.dispatchCallMessage = async (type, payload) => {
  ipcRenderer.send('dispatch-call-message', type, {
    ...payload,
    serviceUrls: await window.Signal.Network.getCallServiceUrls(),
  });
};

ipcRenderer.on('incoming-call-respond', (_, info) => {
  Whisper.events.trigger('incoming-call-respond', info);
});

// 1. clear incoming window if exist
window.destroyCall = async (roomId, reason) => {
  await ipcRenderer.invoke('destroy-call', roomId, reason);
};

ipcRenderer.on('open-add-call-members', (_, { callName, currentMembers }) => {
  const ev = new CustomEvent('global-components-members-change', {
    detail: {
      type: 'call-add',
      callName,
      currentMembers,
    },
  });
  window.dispatchEvent(ev);
});

window.addCallMembers = members => {
  ipc.send('add-call-members', members);
};

window.joinCall = async ({ type, roomId, conversation, ...extra }) => {
  const username = window.textsecure.storage.get('number_id');
  const password = window.textsecure.storage.get('password');
  const deviceId = window.textsecure.storage.user.getDeviceId();
  const isPrivate = type !== 'group';

  ipcRenderer.send('join-call-from-conversation', {
    type,
    isPrivate,
    roomId,
    groupId: conversation,
    number: conversation,
    ...extra,
    username,
    password,
    deviceId,
    serviceUrls: await window.Signal.Network.getCallServiceUrls(),
  });
};

window.hideIncomingCallWindow = async roomId => {
  await ipcRenderer.invoke('hide-incoming-call-window', roomId);
};

// 1. callee reject 2. reject on other device
window.onRejectCall = async roomId => {
  ipcRenderer.send('reject-call-by-callee', roomId);
  await ipcRenderer.invoke('hide-incoming-call-window', roomId);
};

ipcRenderer.on('add-join-call-button', (_, callInfo) => {
  if (callInfo.type === 'instant' && callInfo.prev1on1Numebr) {
    Whisper.events.trigger('callRemove', {
      conversation: callInfo.prev1on1Numebr,
    });
  }
  if (callInfo.createdAt === undefined) {
    callInfo.createdAt = Date.now();
  }
  Whisper.events.trigger('callAdd', callInfo);
});

ipcRenderer.on('sync-call-timer', (_, callInfo) => {
  Whisper.events.trigger('callAdd', {
    ...callInfo,
    createdAt: Date.now(),
  });
});

ipc.on('update-call-status', (event, { roomId }) => {
  window.currentCallRoomId = roomId;
});

async function sendTextToConversations(conversationIds, text, options) {
  for (const id of conversationIds) {
    const conversation = ConversationController.get(id);
    if (!conversation) {
      window.log.warn('Not found conversation for', id);
      continue;
    }

    try {
      await conversation.forceSendMessageAuto(
        text,
        null,
        [],
        null,
        null,
        null,
        null,
        null,
        null,
        options
      );
    } catch (error) {
      window.log.error(`send text to ${id} failed:`, error);
    }
  }
}

async function saveCallLocalMessage(conversationIds, options) {
  const globalConfig = window.getGlobalConfig();
  const recallConfig = globalConfig.recall;

  const { source, serverTimestamp } = options;

  const text = getCallTextMessage(options.action, options.type, source);

  for (const id of conversationIds) {
    const conversation = ConversationController.get(id);
    if (!conversation) {
      window.log.warn('Not found conversation for', id);
      continue;
    }
    const timestamp = textsecure.CallHelper.generateCallMessageTimestamp({
      ...options,
      id,
    });

    let members;

    if (conversation.isPrivate()) {
      members = [id];
    } else {
      members = (conversation.get('members') || []).filter(
        member => member !== options.source
      );
    }

    await conversation.saveNewLocalMessage({
      sent_at: timestamp,
      received_at: timestamp,
      serverTimestamp,
      source: options.source,
      sourceDevice: options.sourceDevice,
      body: text,
      sent: true,
      status: 'sent',
      recallableStartTimestamp: timestamp,
      recallableTimer: recallConfig.timeoutInterval,
      type: 'outgoing',
      recipients: members,
      sent_to: members,
    });

    conversation.set({
      active_at: timestamp,
    });

    await window.Signal.Data.updateConversation(conversation.attributes);
  }
}

function getCallTextMessage(action, type, callerId) {
  const caller = ConversationController.get(callerId);
  const callerName = caller?.getAccountName() ?? '';

  const startCallTextMap = {
    '1on1': 'Calling',
    group: `${callerName} has started a call`,
  };

  switch (action) {
    case textsecure.CallActionType.StartCall: {
      return startCallTextMap[type];
    }
    case textsecure.CallActionType.InviteMembers: {
      return `${callerName} invites you to a call`;
    }
    default: {
      return '';
    }
  }
}

window.getCallTextMessage = getCallTextMessage;

ipc.on('send-call-text', (event, data) => {
  const {
    action,
    type,
    conversationIds,
    createCallMsg,
    timestamp,
    serverTimestamp,
  } = data;

  const ourNumber = textsecure.storage.user.getNumber();

  if (createCallMsg) {
    saveCallLocalMessage(conversationIds, {
      source: ourNumber,
      timestamp,
      sourceDevice: 2,
      callees: conversationIds,
      action,
      ourNumber,
      serverTimestamp,
      type,
    });
  } else {
    sendTextToConversations(
      conversationIds,
      getCallTextMessage(action, type, ourNumber),
      {
        freeConfidential: true,
      }
    );
  }
});

window.preloadCallWindow = () => {
  const username = window.textsecure.storage.get('number_id');
  const password = window.textsecure.storage.get('password');

  ipc.send('preload-call-window', { username, password });
};

window.showMessageInSeparateView = data => {
  try {
    ipc.send('update-separate-view-data', data);
  } catch (e) {
    console.log('show message in separate view error', e);
  }
};

async function getMessageById(messageId) {
  let found = MessageController.getById(messageId);
  if (found) {
    return found;
  }

  const fetched = await window.Signal.Data.getMessageById(messageId, {
    Message: Whisper.Message,
  });

  if (fetched) {
    found = MessageController.register(fetched.id, fetched);
    return found;
  } else {
    window.log.error('message not found in database for ', messageId);
  }
}

ipc.on('read-confidential-message', async (event, id) => {
  const messageModel = await getMessageById(id);
  if (messageModel) {
    messageModel.seeConfidentialMessage();
  }
});

window.getCurrentTheme = () =>
  document.body.classList.contains('dark-theme') ? 'dark' : 'light';

window.getGlobalConfig = () => window.globalConfig;

ipcRenderer.on('open-call-feedback', (_, data) => {
  Whisper.events.trigger('open-call-feedback', data);
});
