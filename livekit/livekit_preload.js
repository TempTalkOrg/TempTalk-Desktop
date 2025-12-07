/* global window */
const { ipcRenderer } = require('electron');
const url = require('url');
const i18n = require('../js/modules/i18n');

const config = url.parse(window.location.toString(), true).query;
// eslint-disable-next-line no-console
const { locale } = config;
const localeMessages = ipcRenderer.sendSync('locale-data');
const bs58 = require('bs58');

const { Window } = require('@cc-kit/node-screenshots');

window.getConfig = () => config;
window.getUserName = () => config.username;
window.getPassword = () => config.password;
window.getEnvironment = () => config.environment;
window.getVersion = () => config.version;
window.isInsiderUpdate = () => config.insiderUpdateEnabled === 'true';
window.getFlavorId = () => config.flavorId;

require('../js/logging');

window.React = require('react');
window.ReactDOM = require('react-dom');
window.moment = require('moment');
window.i18n = i18n.setup(locale, localeMessages);

window.MESSAGE_CURRENT_VERSION = 2;
window.MESSAGE_MINIMUM_SUPPORTED_VERSION = 2;

window.CALL_VERSION = 10;

const { platform, arch } = process;
window.libCryptoClient = require(`../lib-crypto-client/${platform}/${arch}`);

window.badSelfSignedCert = () => ipcRenderer.sendSync('bad-self-signed-cert');

const { initialize: initializeWebAPI } = require('../js/modules/web_api');

window.WebAPI = initializeWebAPI({
  certificateAuthority: config.certificateAuthority,
  proxyUrl: config.proxyUrl,
  flavorId: window.getFlavorId(),
  insiderUpdate: window.isInsiderUpdate(),
});

ipcRenderer.on('freshWebApiUrlCache', (_, info) => {
  try {
    window.freshWebApiUrlCache(JSON.parse(info));
  } catch (e) {
    console.log('freshWebApiUrlCache error', e);
  }
});

const Signal = require('../js/modules/signal');

window.Signal = Signal.setup({
  logger: window.log,
});

// return NodeJs Buffer
window.digestMD5 = arrayBuffer => {
  const md5 = require('crypto').createHash('md5');
  return md5.update(Buffer.from(arrayBuffer)).digest();
};

window.getCallView = () => {
  const { CallRoot } = require('../ts/components/call');
  return CallRoot;
};

window.getAllContacts = async () => {
  return new Promise(resolve => {
    ipcRenderer.once('meeting-get-all-contacts', (_, contacts) => {
      resolve(contacts);
    });

    ipcRenderer.send('meeting-get-all-contacts');
  });
};

function registerIPCEventHandler(event, handler) {
  ipcRenderer.on(event, handler);

  return () => {
    ipcRenderer.removeListener(event, handler);
  };
}

window.registerDestroyCallHandler = handler => {
  return registerIPCEventHandler('destroy-call', handler);
};

window.registerRejectByCalleeHandler = handler => {
  return registerIPCEventHandler('reject-call-by-callee', handler);
};

window.finishJoinCall = roomId => {
  ipcRenderer.send('finish-join-call', roomId);
  ipcRenderer.send('update-call-status', { roomId });
};

window.closeCallWindow = () => {
  ipcRenderer.send('close-call-window');
  ipcRenderer.send('update-call-status', { roomId: null });
  ipcRenderer.send('update-floating-bar', { countdown: null });
};

window.openCallFeedback = data => {
  ipcRenderer.send('open-call-feedback', data);
};

window.openAddCallMembers = (callName, currentMembers) => {
  ipcRenderer.send('open-add-call-members', callName, currentMembers);
};

window.registerInviteCallMembersHandler = handler => {
  return registerIPCEventHandler('invite-call-members', handler);
};

window.resizeCallWindow = size => {
  ipcRenderer.send('resize-call-window', size);
};

window.checkMediaPermission = async mediaType => {
  return ipcRenderer.invoke('check-media-permission', mediaType);
};

window.sendBrowserOpenUrl = link => {
  ipcRenderer.send('browser-open-url', { target: link });
};

window.addJoinCallButton = callInfo => {
  const data = {
    ...callInfo,
    caller: {
      uid: callInfo.caller,
    },
    conversation:
      callInfo.type === 'group' ? callInfo.groupId : callInfo.number,
  };
  ipcRenderer.send('add-join-call-button', data);
};

window.removeJoinCallButton = roomId => {
  return ipcRenderer.send('remove-join-call-button', { roomId });
};

window.syncCallTimer = callInfo => {
  ipcRenderer.send('sync-call-timer', callInfo);
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

window.getGroupMembers = async groupId => {
  return ipcRenderer.invoke('get-group-members', groupId);
};

window.sendCallText = data => {
  ipcRenderer.send('send-call-text', data);
};

window.registerStartCallHandler = handler => {
  return registerIPCEventHandler('start-call', handler);
};

window.registerFloatingBarHangupHandler = handler => {
  return registerIPCEventHandler('floating-bar-hangup', handler);
};

window.registerFloatingBarSetMutedHandler = handler => {
  return registerIPCEventHandler('floating-bar-set-muted', handler);
};

window.updateFloatingBar = data => {
  ipcRenderer.send('update-floating-bar', data);
};

window.toggleFloatingBar = show => {
  if (show) {
    ipcRenderer.send('show-floating-bar');
  } else {
    ipcRenderer.send('hide-floating-bar');
  }
};

window.onBackToMainWindow = () => {
  ipcRenderer.send('show-window');
};

window.registerOpenCountdownTimerPopupHandler = handler => {
  return registerIPCEventHandler('open-countdown-timer-popup', handler);
};

const getDesktopCaptureSources = async options =>
  ipcRenderer.invoke('get-desktop-capture-sources', options);

const listWindows = () => Window.listAll();

window.getSources = async () => {
  let sources;
  if (window.Signal.OS.isMacOS()) {
    const listWindowTime = Date.now();
    const windowItems = listWindows();
    console.log('[getSources] listWindowTime:', Date.now() - listWindowTime);

    const listScreenTime = Date.now();
    const screenItems = await getDesktopCaptureSources({
      types: ['screen'],
      thumbnailSize: { width: 250, height: 150 },
    });
    console.log('[getSources] listScreenTime:', Date.now() - listScreenTime);

    const windowItemPromises = windowItems.map(async windowItem => {
      try {
        const thumbnail = await windowItem.captureThumbnail();
        return {
          id: `window:${windowItem.id()}:0`,
          name: windowItem.title(),
          async thumbnailDataURI() {
            return `data:image/png;base64,${(await thumbnail.toPng()).toString('base64')}`;
          },
        };
      } catch (e) {
        return null;
      }
    });

    const formatItemTime = Date.now();
    const windowItemResults = (await Promise.all(windowItemPromises)).filter(
      Boolean
    );
    console.log('[getSources] formatItemTime:', Date.now() - formatItemTime);

    sources = screenItems.concat(windowItemResults);
  } else {
    sources = await getDesktopCaptureSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 250, height: 150 },
    });
  }

  sources = sources.sort((a, b) => {
    if (a.id.startsWith('screen:')) {
      if (b.id.startsWith('screen:')) {
        return 0;
      } else {
        return -1;
      }
    } else {
      return 1;
    }
  });

  return sources;
};

window.listOnScreenWindows = () => Window.all();

window.snedFrameToFloatingBar = frameInfo => {
  ipcRenderer.send('sned-frame-to-floating-bar', frameInfo);
};

window.isSupportMacShareScreenKit = () => {
  // require on demand
  const macScreenShare = require('@indutny/mac-screen-share');
  return macScreenShare.isSupported;
};

window.getMacScreenShare = options => {
  const macScreenShare = require('@indutny/mac-screen-share');
  return macScreenShare;
};
