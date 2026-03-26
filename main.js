/* eslint-disable no-console */

const path = require('path');
const url = require('url');
const os = require('os');
const fse = require('fs-extra');
const _ = require('lodash');
const electron = require('electron');
const fetch = require('node-fetch');
const { formatError } = require('./ts/logger/utils');
const { markShouldQuit } = require('./app/window_state');
const { shellOpenExternal } = require('./ts/util/shellOpenExternal');
const { initAppEnv } = require('./ts/util/appEnvironment');
const { setup: setupCrashReporter } = require('./ts/crashReports/reporter');
const OS = require('./ts/OS');
const { isFileDangerous } = require('./ts/util/isFileDangerous');

// initial config firstly, cause initAppEnv will use config
const config = require('./app/config');

// App environment should be initialized early
initAppEnv(config);

setupCrashReporter();

// Add right-click listener for selected text and urls
const contextMenu = require('electron-context-menu');
contextMenu({
  showCopyLink: true,
  showInspectElement: false,
  showLookUpSelection: false,
  showSearchWithGoogle: false,
  showSelectAll: false,
  shouldShowMenu: (event, params) =>
    Boolean(
      !params.isEditable &&
        params.mediaType === 'none' &&
        (params.linkURL || params.selectionText)
    ),
});

const packageJson = require('./package.json');
const GlobalErrors = require('./app/global_errors');
GlobalErrors.addHandler();

const {
  app,
  autoUpdater,
  BrowserWindow,
  desktopCapturer,
  clipboard,
  ipcMain: ipc,
  Menu,
  protocol: electronProtocol,
  session,
  dialog,
  nativeTheme,
  shell,
  systemPreferences,
  powerMonitor,
  powerSaveBlocker,
} = electron;

// Fix screen-sharing thumbnails being missing sometimes
// See https://github.com/electron/electron/issues/44504
const disabledFeatures = [
  'ThumbnailCapturerMac:capture_mode/sc_screenshot_manager',
  'ScreenCaptureKitPickerScreen',
  'ScreenCaptureKitStreamPickerSonoma',
];

app.commandLine.appendSwitch('disable-features', disabledFeatures.join(','));

if (OS.isLinux()) {
  // force using gtk 3 on linux, default gtk 4 is not compatible on all linux
  app.commandLine.appendSwitch('gtk-version', '3');
}

ipc.on('copy', () => {
  let num = 10;
  const prev = '';
  clipboard.writeText(prev);

  const interval = setInterval(() => {
    const newest = clipboard.readText('clipboard');
    if (prev !== newest) {
      clipboard.writeText(newest);

      clearInterval(interval);
      return;
    }
    if (prev === newest && num > 0) {
      num--;
    }
    if (num <= 0) {
      clearInterval(interval);
    }
  }, 100);
});

const ASSOCIATED_PROTOCOLS = ['chative:', 'temptalk:'];

async function handleUrl(event, params) {
  const { target } = params || {};

  if (event) {
    event.preventDefault();
  }

  if (!target) {
    console.log('invalid target url.');
    return;
  }

  try {
    console.log('main.js handleUrl target', target.split('?')[0]);

    if (target.startsWith('x-apple.systempreferences:')) {
      return shellOpenExternal(target);
    }

    const { host, protocol, pathname } = url.parse(target);
    if (protocol === 'http:' || protocol === 'https:') {
      await shellOpenExternal(target);
    } else if (ASSOCIATED_PROTOCOLS.includes(protocol)) {
      const params = new URL(target).searchParams;
      if (host === 'localaction') {
        if (pathname === '/invite') {
          const a = params.get('a');
          const pi = params.get('pi');
          if (a === 'pi' && pi) {
            mainWindow.webContents.send('query-user-by-inviteCode', pi);
          } else {
            console.warn('invalid invite link', target);
          }
        }
      }
    }
  } catch (e) {
    console.warn('main.js handleUrl exception:', e);
  }
}

app.on('will-finish-launching', () => {
  // open-url must be set from within will-finish-launching for macOS
  // https://stackoverflow.com/a/43949291
  app.on('open-url', (event, hrefUrl) => {
    event.preventDefault();
    // 客户端还未启动的情况，先启动客户端
    if (!mainWindow) {
      return;
    }

    // meeting 跳转
    showWindow();
    handleUrl(event, { target: hrefUrl });
  });
});

let globalTheme = 'system';

// Keep a global reference of the window object, if you don't, the window will
//   be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function getMainWindow() {
  return mainWindow;
}

// Tray icon and related objects
let tray = null;
const startInTray = process.argv.some(arg => arg === '--start-in-tray');
const usingTrayIcon =
  startInTray || process.argv.some(arg => arg === '--use-tray-icon');

// Very important to put before the single instance check, since it is based on the
//   userData directory.
const userConfig = require('./app/user_config');
const sqlConfig = require('./app/sql_config');

let tempDataPath;

try {
  const tempDataSubPath = userConfig.get('tempDataSubPath');
  if (!tempDataSubPath) {
    tempDataPath = fse.mkdtempSync(path.join(app.getPath('temp'), 'tt-'));
    userConfig.set(
      'tempDataSubPath',
      path.relative(app.getPath('temp'), tempDataPath)
    );
  } else {
    tempDataPath = path.join(app.getPath('temp'), tempDataSubPath);
    fse.ensureDirSync(tempDataPath);
  }
} catch (error) {
  console.error('error creating temp folder', error);
}

async function cleanupOldTempFolder() {
  try {
    const oldTempFolder = path.join(app.getPath('userData'), 'tempFiles/');
    const exists = await fse.exists(oldTempFolder);
    if (exists) {
      await fse.remove(oldTempFolder);
    }
  } catch (error) {
    console.error('error cleaning up old temp folder', error);
  }
}

cleanupOldTempFolder();

// 默认开启硬件加速
// 禁用当前应用程序的硬件加速。这个方法只能在应用程序准备就绪（ready）之前调用。
const disableHardware = userConfig.get('disableHardwareAcceleration') || false;
if (disableHardware) {
  app.disableHardwareAcceleration();
}

const development = config.environment === 'development';

// We generally want to pull in our own modules after this point, after the user
//   data directory has been set.
const updater = require('./ts/updater/index');
const createTrayIcon = require('./app/tray_icon');
const ephemeralConfig = require('./app/ephemeral_config');
const logging = require('./app/logging');
const windowState = require('./app/window_state');
const { createTemplate } = require('./app/menu');
const {
  installFileHandler,
  installWebHandler,
} = require('./app/protocol_filter');
const { installPermissionsHandler } = require('./app/permissions');

const {
  generateNewDBKey,
  AsymmetricKeyManager,
} = require('./ts/sql/keyManager/secretCrypto');

const {
  LegacyDBKey,
  SecretAuxiliary,
  updateAuxiliraies,
  upgradeBackupSqls,
} = require('./ts/sql/keyManager/config');

const { SqlManagement } = require('./ts/sql/sqlManagement');
const sql = new SqlManagement();

function showWindow() {
  if (!mainWindow) {
    return;
  }

  // Using focus() instead of show() seems to be important on Windows when our window
  //   has been docked using Aero Snap/Snap Assist. A full .show() call here will cause
  //   the window to reposition:
  //   https://github.com/signalapp/Signal-Desktop/issues/1429
  if (mainWindow.isVisible()) {
    mainWindow.focus();
  } else {
    mainWindow.show();
  }

  // toggle the visibility of the show/hide tray icon menu entries
  if (tray) {
    tray.updateContextMenu();
  }
}

if (!process.mas) {
  console.log('making app single instance');
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    console.log('quitting; we are the second instance');
    app.exit();
  } else {
    app.on('second-instance', (event, argv, workingDirectory) => {
      console.log('second-instance', argv, workingDirectory);

      // Someone tried to run a second instance, we should focus our window
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }

        showWindow();
      }

      const incomingUrl = argv.find(
        arg => arg && ASSOCIATED_PROTOCOLS.some(ap => arg.startsWith(ap))
      );
      if (incomingUrl) {
        handleUrl(event, { target: incomingUrl });
      }

      return true;
    });
  }
}

const windowFromUserConfig = userConfig.get('window');
const windowFromEphemeral = ephemeralConfig.get('window');
let windowConfig = windowFromEphemeral || windowFromUserConfig;
if (windowFromUserConfig) {
  userConfig.set('window', null);
  ephemeralConfig.set('window', windowConfig);
}

const loadLocale = require('./app/locale').load;

// Both of these will be set after app fires the 'ready' event
let logger;
let locale;
let appLocale;
let userDataPath;

function prepareURL(pathSegments, moreKeys) {
  const buildAt = config.has('buildAt') ? config.get('buildAt') : undefined;

  const CIBuildNumber = config.has('CIBuildNumber')
    ? config.get('CIBuildNumber')
    : undefined;

  const lastCommitSha = config.has('lastCommitSha')
    ? config.get('lastCommitSha')
    : undefined;

  const lastCommitTime = config.has('lastCommitTime')
    ? config.get('lastCommitTime')
    : undefined;

  return url.format({
    pathname: path.join.apply(null, pathSegments),
    protocol: 'file:',
    slashes: true,
    query: {
      systemTheme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
      name: packageJson.productName,
      version: app.getVersion(),
      buildExpiration: config.get('buildExpiration'),
      certificateAuthority: config.get('certificateAuthority'),
      buildAt,
      CIBuildNumber,
      lastCommitSha,
      lastCommitTime,
      environment: config.environment,
      node_version: process.versions.node,
      hostname: os.hostname(),
      appInstance: process.env.NODE_APP_INSTANCE,
      proxyUrl: process.env.HTTPS_PROXY || process.env.https_proxy,
      platform: process.platform,
      arch: process.arch,
      runningUnderArch: updater.getRunningUnderArch(),
      insiderUpdateEnabled: updater.isInsiderUpdate(),
      flavorId: config.get('flavorId'),
      tempDataPath,
      locale: app.getLocale(),
      userDataPath,
      ...moreKeys,
    },
  });
}

function captureClicks(window) {
  window.webContents.on('will-navigate', (event, url) => {
    handleUrl(event, { target: url });
  });
  window.webContents.on('new-window', (event, url) => {
    handleUrl(event, { target: url });
  });
}

const DEFAULT_WIDTH = 1024;
const DEFAULT_HEIGHT = 768;
const MIN_WIDTH = 960;
const MIN_HEIGHT = 680;
const BOUNDS_BUFFER = 100;

function isVisible(window, bounds) {
  const boundsX = _.get(bounds, 'x') || 0;
  const boundsY = _.get(bounds, 'y') || 0;
  const boundsWidth = _.get(bounds, 'width') || DEFAULT_WIDTH;
  const boundsHeight = _.get(bounds, 'height') || DEFAULT_HEIGHT;

  // requiring BOUNDS_BUFFER pixels on the left or right side
  const rightSideClearOfLeftBound =
    window.x + window.width >= boundsX + BOUNDS_BUFFER;
  const leftSideClearOfRightBound =
    window.x <= boundsX + boundsWidth - BOUNDS_BUFFER;

  // top can't be offscreen, and must show at least BOUNDS_BUFFER pixels at bottom
  const topClearOfUpperBound = window.y >= boundsY;
  const topClearOfLowerBound =
    window.y <= boundsY + boundsHeight - BOUNDS_BUFFER;

  return (
    rightSideClearOfLeftBound &&
    leftSideClearOfRightBound &&
    topClearOfUpperBound &&
    topClearOfLowerBound
  );
}

async function createWindow() {
  const { screen } = electron;
  const windowOptions = Object.assign(
    {
      show: !startInTray, // allow to start minimised in tray
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,

      backgroundColor: '#ffffff',
      webPreferences: {
        nodeIntegration: false,
        nodeIntegrationInWorker: false,
        contextIsolation: false,
        preload: path.join(__dirname, 'preload.js'),
        enableRemoteModule: false,
        sandbox: false,
      },
      icon: path.join(__dirname, 'images', 'icon_256.png'),

      // auto hide menu bar
      autoHideMenuBar: true,

      // mac: only has the STANDARD window controls("traffic lights")
      // linux & windows: has the STANDARD title bar
      titleBarStyle: OS.isMacOS() ? 'hidden' : 'default',

      acceptFirstMouse: true,
    },
    _.pick(windowConfig, [
      'maximized',
      // 'autoHideMenuBar',
      'width',
      'height',
      'x',
      'y',
    ])
  );

  if (!_.isNumber(windowOptions.width) || windowOptions.width < MIN_WIDTH) {
    windowOptions.width = DEFAULT_WIDTH;
  }
  if (!_.isNumber(windowOptions.height) || windowOptions.height < MIN_HEIGHT) {
    windowOptions.height = DEFAULT_HEIGHT;
  }
  if (!_.isBoolean(windowOptions.maximized)) {
    delete windowOptions.maximized;
  }
  if (!_.isBoolean(windowOptions.autoHideMenuBar)) {
    delete windowOptions.autoHideMenuBar;
  }

  const visibleOnAnyScreen = _.some(screen.getAllDisplays(), display => {
    if (!_.isNumber(windowOptions.x) || !_.isNumber(windowOptions.y)) {
      return false;
    }

    return isVisible(windowOptions, _.get(display, 'bounds'));
  });
  if (!visibleOnAnyScreen) {
    console.log('Location reset needed');
    delete windowOptions.x;
    delete windowOptions.y;
  }

  if (windowOptions.fullscreen === false) {
    delete windowOptions.fullscreen;
  }

  logger.info(
    'Initializing BrowserWindow config: %s',
    JSON.stringify(windowOptions)
  );

  // Create the browser window.
  mainWindow = new BrowserWindow(windowOptions);

  function captureAndSaveWindowStats() {
    if (!mainWindow) {
      return;
    }

    const size = mainWindow.getSize();
    const position = mainWindow.getPosition();

    // so if we need to recreate the window, we have the most recent settings
    windowConfig = {
      maximized: mainWindow.isMaximized(),
      // autoHideMenuBar: mainWindow.isMenuBarAutoHide(),
      width: size[0],
      height: size[1],
      x: position[0],
      y: position[1],
    };

    if (mainWindow.isFullScreen()) {
      // Only include this property if true, because when explicitly set to
      // false the fullscreen button will be disabled on osx
      windowConfig.fullscreen = true;
    }

    // logger.info(
    //   'Updating BrowserWindow config: %s',
    //   JSON.stringify(windowConfig)
    // );
    ephemeralConfig.set('window', windowConfig);
  }

  const debouncedCaptureStats = _.debounce(captureAndSaveWindowStats, 500);
  mainWindow.on('resize', debouncedCaptureStats);
  mainWindow.on('move', debouncedCaptureStats);

  mainWindow.on('focus', () => {
    mainWindow.flashFrame(false);
  });

  // Ingested in preload.js via a sendSync call
  ipc.on('locale-data', event => {
    event.returnValue = locale.messages;
  });

  if (config.environment === 'test') {
    mainWindow.loadURL(prepareURL([__dirname, 'test', 'index.html']));
  } else if (config.environment === 'test-lib') {
    mainWindow.loadURL(
      prepareURL([__dirname, 'libtextsecure', 'test', 'index.html'])
    );
  } else {
    mainWindow.loadURL(
      prepareURL([__dirname, 'background.html'], {
        dbInitialized: sql.isInitialized(),
      })
    );
  }

  mainWindow.webContents.session.webRequest.onHeadersReceived(
    { urls: ['*://*/*'] },
    (d, c) => {
      const resHeadersStr = JSON.stringify(Object.keys(d.responseHeaders));
      // 在这里把你想要移除的header头部添加上，代码中已经实现了忽略大小了，所以不用担心匹配不到大小写的问题
      const removeHeaders = ['X-Frame-Options', 'Content-Security-Policy'];
      removeHeaders.forEach(header => {
        const regPattern = new RegExp(header, 'ig');
        const matchResult = resHeadersStr.match(regPattern);
        if (matchResult && matchResult.length) {
          matchResult.forEach(i => {
            delete d.responseHeaders[i];
          });
        }
      });
      c({ cancel: false, responseHeaders: d.responseHeaders });
    }
  );

  if (config.get('openDevTools')) {
    // Open the DevTools.
    mainWindow.webContents.openDevTools();
  }

  captureClicks(mainWindow);

  // 获取权限相关, 先全部放开
  mainWindow.webContents.session.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      callback(true);
    }
  );
  mainWindow.webContents.session.setPermissionCheckHandler(() => {
    return true;
  });

  // set spell check languages
  if (OS.isLinux() || OS.isWindows()) {
    const { availableSpellCheckerLanguages } = mainWindow.webContents.session;
    if (availableSpellCheckerLanguages.includes(locale.name)) {
      mainWindow.webContents.session.setSpellCheckerLanguages([locale.name]);
    } else {
      mainWindow.webContents.session.setSpellCheckerLanguages(['en-US']);
    }
  }

  mainWindow.webContents.on('context-menu', (event, params) => {
    if (!params?.isEditable) {
      return;
    }

    const messages = locale.messages;
    const template = [];

    if (params.misspelledWord) {
      const { dictionarySuggestions } = params;

      if (dictionarySuggestions.length) {
        // Add each spelling suggestion
        for (const suggestion of params.dictionarySuggestions) {
          template.push({
            label: suggestion,
            click: () => mainWindow.webContents.replaceMisspelling(suggestion),
          });
        }
      } else {
        template.push({
          label: 'No suggestions',
          enabled: false,
        });
      }
      template.push({ type: 'separator' });
    }

    const { editFlags } = params;

    if (editFlags.canUndo) {
      template.push({
        label: messages.editMenuUndo.message,
        role: 'undo',
        accelerator: 'CmdOrCtrl+Z',
      });
    }

    if (editFlags.canRedo) {
      template.push({
        label: messages.editMenuRedo.message,
        role: 'redo',
        accelerator: 'Shift+CmdOrCtrl+Z',
      });
    }

    if (editFlags.canUndo || editFlags.canRedo) {
      template.push({ type: 'separator' });
    }

    if (editFlags.canCut) {
      template.push({
        role: 'cut',
        label: messages.editMenuCut.message,
        accelerator: 'CmdOrCtrl+X',
      });
    }

    if (params.selectionText) {
      template.push({
        role: 'copy',
        label: messages.editMenuCopy.message,
        accelerator: 'CmdOrCtrl+C',
      });
      template.push({
        role: 'delete',
        label: messages.editMenuDelete.message,
      });
    }

    if (editFlags.canPaste) {
      template.push({
        role: 'paste',
        label: messages.editMenuPaste.message,
        accelerator: 'CmdOrCtrl+V',
      });
      // template.push({
      //   role: 'pasteandmatchstyle',
      //   label: messages.editMenuPasteAndMatchStyle.message,
      // });
    }

    if (editFlags.canSelectAll) {
      template.push({
        role: 'selectall',
        label: messages.editMenuSelectAll.message,
        accelerator: 'CmdOrCtrl+A',
      });
    }

    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: mainWindow });
  });

  // Emitted when the window is about to be closed.
  // Note: We do most of our shutdown logic here because all windows are closed by
  //   Electron before the app quits.
  mainWindow.on('close', async e => {
    console.log('close event', {
      readyForShutdown: mainWindow ? mainWindow.readyForShutdown : null,
      shouldQuit: windowState.shouldQuit(),
    });
    // If the application is terminating, just do the default
    if (
      config.environment === 'test' ||
      config.environment === 'test-lib' ||
      (mainWindow.readyForShutdown && windowState.shouldQuit())
    ) {
      return;
    }

    // Prevent the shutdown
    e.preventDefault();

    /**
     * if the user is in fullscreen mode and closes the window, not the
     * application, we need them leave fullscreen first before closing it to
     * prevent a black screen.
     *
     * issue: https://github.com/signalapp/Signal-Desktop/issues/4348
     */

    if (mainWindow.isFullScreen()) {
      mainWindow.once('leave-full-screen', () => mainWindow.hide());
      mainWindow.setFullScreen(false);
    } else {
      mainWindow.hide();
    }

    // On Mac, or on other platforms when the tray icon is in use, the window
    // should be only hidden, not closed, when the user clicks the close button
    if (!windowState.shouldQuit() && (usingTrayIcon || OS.isMacOS())) {
      // toggle the visibility of the show/hide tray icon menu entries
      if (tray) {
        tray.updateContextMenu();
      }

      return;
    }

    await requestShutdown();
    if (mainWindow) {
      mainWindow.readyForShutdown = true;
    }
    await sql.close(true);

    try {
      fse.emptyDirSync(tempDataPath);
    } catch (error) {
      console.error('error emptying temp folder', error);
    }

    app.quit();
  });

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

ipc.on('show-window', () => {
  showWindow();
});

let updatesStarted = false;

ipc.on('ready-for-updates', async () => {
  // test reboot button
  // mainWindow.webContents.send('show-update-button');

  if (updatesStarted) {
    return;
  }
  updatesStarted = true;

  try {
    await updater.start({ getMainWindow }, locale.messages, logger);
  } catch (error) {
    logger.error(
      'Error starting update checks:',
      error && error.stack ? error.stack : error
    );
  }
});

function setupAsNewDevice() {
  if (mainWindow) {
    mainWindow.webContents.send('set-up-as-new-device');
  }
}

function setupAsStandalone() {
  if (mainWindow) {
    mainWindow.webContents.send('set-up-as-standalone');
  }
}

let aboutWindow;

async function showAbout() {
  const theme = globalTheme;
  if (aboutWindow) {
    aboutWindow.show();
    return;
  }

  const options = {
    width: 540,
    height: 380,
    resizable: false,
    title: locale.messages.aboutDesktop.message,
    backgroundColor: '#2090EA',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: false,
      preload: path.join(__dirname, 'about_preload.js'),
      enableRemoteModule: false,
      sandbox: false,
    },
    acceptFirstMouse: true,
    // parent: mainWindow,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,

    // mac: "hidden"
    //   only has the STANDARD window controls("traffic lights")
    // linux & windows: "hidden" combined with titleBarOverlay(true)
    //   it will activate the Window Controls Overlay
    //   has the CUSTOM window controls
    titleBarStyle: 'hidden',

    // has overlay for light/dark theme
    titleBarOverlay: true,
  };

  aboutWindow = new BrowserWindow(options);

  // hide menu bar
  aboutWindow.setMenuBarVisibility(false);

  captureClicks(aboutWindow);

  aboutWindow.loadURL(prepareURL([__dirname, 'about.html'], { theme }));

  aboutWindow.on('closed', () => {
    aboutWindow = null;
  });

  aboutWindow.once('ready-to-show', () => {
    aboutWindow.show();
  });
}

ipc.on('main-window-openDevTools', () => {
  if (mainWindow) {
    mainWindow.webContents.openDevTools();
  }
  if (callWindow) {
    callWindow.webContents.openDevTools();
  }
});

let webApiUrlCache;

let callWindow;
let callWindowReady;

const CALL_WINDOW_SIZE = {
  '1on1': {
    width: 560,
    height: 642,
    minWidth: 560,
    minHeight: 642,
  },
  group: {
    width: 768,
    height: 576,
    minWidth: 768,
    minHeight: 576,
  },
  instant: {
    width: 768,
    height: 576,
    minWidth: 768,
    minHeight: 576,
  },
};

let username;
let password;

function preloadCallWindow() {
  const options = {
    width: 768,
    height: 576,
    minWidth: 768,
    minHeight: 576,
    // autoHideMenuBar: true,
    backgroundColor: '#0b0e11',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: false,
      preload: path.join(__dirname, 'livekit/livekit_preload.js'),
      nativeWindowOpen: true,
      enableRemoteModule: false,
      sandbox: false,
    },
    acceptFirstMouse: true,
    // mac: only has the STANDARD window controls("traffic lights")
    // linux & windows: has the STANDARD title bar
    titleBarStyle: OS.isMacOS() ? 'hidden' : 'default',

    // has NO overlay
    titleBarOverlay: false,
  };

  callWindow = new BrowserWindow(options);
  callWindow.setMenuBarVisibility(false);

  captureClicks(callWindow);

  callWindow.loadURL(
    prepareURL([__dirname, 'livekit/meeting.html'], {
      username,
      password,
      webApiUrlCache,
    })
  );

  callWindow.on('closed', () => {
    callWindow = null;
    callWindowReady = null;
    if (mainWindow) {
      mainWindow.webContents.send('call-window-closed');
    }
    removeSidebarItem('call');
    if (!windowState.shouldQuit()) {
      preloadCallWindow();
    }
  });

  callWindowReady = new Promise(resolve => {
    callWindow.webContents.on('did-finish-load', resolve);
  }).then(() => {
    callWindow.webContents.send('freshWebApiUrlCache', webApiUrlCache);
  });

  if (development) {
    callWindow.webContents.openDevTools();
    // callWindow.show();
  }
}

async function showLivekitCallWindow(info) {
  if (!callWindow) {
    console.log('callWindow not found');
    preloadCallWindow();
  }

  await callWindowReady;
  // 调整窗口大小
  const size = CALL_WINDOW_SIZE[info.type];
  callWindow.setMinimumSize(size.minWidth, size.minHeight);
  callWindow.setSize(size.width, size.height, false);

  // 显示窗口
  if (callWindow.isMinimized()) {
    callWindow.restore();
  } else {
    callWindow.show();
  }

  addSidebarItem('call', callWindow);

  // 通过 IPC 发送会议信息
  callWindow.isCalling = true;
  callWindow.webContents.send('start-call', {
    ...info,
    callWindowId: callWindow.getMediaSourceId(),
  });
}

function showSettings() {
  if (!mainWindow) {
    return;
  }
  mainWindow.webContents.send('event-open-user-setting');
}

let permissionsPopupWindow;

async function showPermissionsPopupWindow() {
  if (permissionsPopupWindow) {
    permissionsPopupWindow.show();
    return;
  }
  if (!mainWindow) {
    return;
  }

  const theme = globalTheme;
  const size = mainWindow.getSize();
  const options = {
    width: Math.min(400, size[0]),
    height: Math.min(150, size[1]),
    resizable: false,
    title: locale.messages.desktopPreferences.message,
    // autoHideMenuBar: true,
    backgroundColor: '#FFFFFF',
    show: false,
    modal: true,
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: false,
      preload: path.join(__dirname, 'permissions_popup_preload.js'),
      enableRemoteModule: false,
      sandbox: false,
    },
    acceptFirstMouse: true,
    parent: mainWindow,

    // mac: only has the STANDARD window controls("traffic lights")
    // linux & windows: has the STANDARD title bar
    titleBarStyle: OS.isMacOS() ? 'hidden' : 'default',

    // has NO overlay
    titleBarOverlay: false,
  };

  permissionsPopupWindow = new BrowserWindow(options);
  permissionsPopupWindow.setMenuBarVisibility(false);

  captureClicks(permissionsPopupWindow);

  permissionsPopupWindow.loadURL(
    prepareURL([__dirname, 'permissions_popup.html'], { theme })
  );

  permissionsPopupWindow.on('closed', () => {
    removeDarkOverlay();
    permissionsPopupWindow = null;
  });

  permissionsPopupWindow.once('ready-to-show', () => {
    addDarkOverlay();
    permissionsPopupWindow.show();
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
let ready = false;

app.on('ready', async () => {
  userDataPath = await fse.realpath(app.getPath('userData'));
  const installPath = await fse.realpath(app.getAppPath());
  const mainExePath = await fse.realpath(app.getPath('exe'));

  const { version, productName } = packageJson;

  await logging.initialize();
  logger = logging.getLogger();
  logger.info('app ready, disableHardwareAcceleration:', disableHardware);
  logger.info(`starting app ${productName} ${installPath}`);
  logger.info(`starting version ${version}`);
  logger.info(`starting command line:${JSON.stringify(process.argv)}`);

  const { checkApplicationPath } = require('./ts/updater/checkApplicationPath');
  if (!checkApplicationPath(logger, productName, installPath, mainExePath)) {
    app.exit();
    return;
  }

  if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'test-lib') {
    installFileHandler({
      protocol: electronProtocol,
      userDataPath,
      installPath,
      isWindows: process.platform === 'win32',
    });
  }

  installWebHandler({
    protocol: electronProtocol,
  });

  installPermissionsHandler({ session, userConfig });

  const { watchFileChange } = require('./ts/util/appChangeWatcher');
  watchFileChange(mainExePath, path => {
    logger.warn('app file changes detected', path);

    const response = dialog.showMessageBoxSync({
      buttons: ['Relaunch', 'Quit'],
      defaultId: 0,
      message:
        'App version changes detected, please relaunch or quit the application!',
      noLink: true,
      type: 'error',
    });

    logger.warn('click index(0-relaunch, 1-quit):', response);

    if (response === 0) {
      app.relaunch();
    }

    app.quit();
  });

  if (!locale) {
    // 中文测试
    // const appLocale = 'zh-CN'
    // const appLocale = process.env.NODE_ENV === 'test' ? 'en' : app.getLocale();
    const language = app.getLocale() === 'zh-CN' ? 'zh-CN' : 'en';
    appLocale = userConfig.get('userLanguage') || language;
    locale = loadLocale({ appLocale, logger });
  }

  GlobalErrors.updateLocale(locale.messages);

  upgradeBackupSqls(logger);

  let dbKey = undefined;

  if (
    sqlConfig.get('secretPublicKey') &&
    sqlConfig.get('secretPrivateKey') &&
    (userConfig.get('secretAuxiliary') || sqlConfig.get('secretAuxiliary'))
  ) {
    logger.info('key/initialize: already upgraded');
  } else {
    logger.info('key/initialize: not-be-upgraded OR incomplete upgrade');

    try {
      const legacyDBKey = new LegacyDBKey(logger, userConfig);
      dbKey = legacyDBKey.read();

      if (dbKey) {
        logger.info('key/initialize: found legacy key');
      } else {
        logger.info(
          'key/initialize: Generating new encryption key, since we did not find it on disk'
        );

        dbKey = generateNewDBKey();
        try {
          legacyDBKey.save(dbKey);
        } catch (error) {
          logger.warn('save leagcy key error', formatError(error));
        }
      }
    } catch (error) {
      logger.warn(
        'key/initialize: failed to read legacy db key',
        formatError(error)
      );
    }
  }

  if (dbKey) {
    logger.info('using key to initialize db.');
    try {
      await sql.initialize({ configDir: userDataPath, key: dbKey, logger });
    } catch (error) {
      logger.error('sql initialize db with key failed', error);
      sql.onDatabaseError(error, locale.messages);
      return;
    }
  }

  ready = true;

  createWindow();

  if (usingTrayIcon) {
    tray = createTrayIcon(getMainWindow, locale.messages);
  }

  setupMenu();
});

let dbNewKey = null;

function installIpcHandler(name, fn) {
  ipc.on(`ipc-call-${name}`, async (event, params) => {
    const contents = event.sender;
    if (contents.isDestroyed()) {
      return;
    }

    let result = undefined;
    let error = undefined;

    try {
      result = await fn(params);
    } catch (e) {
      error = `call ${name} error ` + e.name;
    }

    contents.send(`ipc-call-success-${name}`, error, result);

    return;
  });
}

let dbSecret;

installIpcHandler('signParams', async params => {
  if (!dbSecret) {
    throw new Error('db secret manager was not initialized.');
  }

  return dbSecret.privateSign(params);
});

// 1 get exists dbkey successfully
// 2 upload dbKey successfully
//   2.1 upload renew dbKey when upgrade from old version, user login status no-changed
//   2.2 upload new dbKey when user re-login
installIpcHandler('initDBWithSecret', async secretDBKey => {
  if (!dbSecret) {
    throw new Error('db secret manager was not initialized.');
  }

  if (sql.isInitialized()) {
    throw new Error('should not come here for db has already been initlized.');
  }

  let dbKey;

  try {
    dbKey = await dbSecret.privateDecrypt(secretDBKey);
  } catch (error) {
    console.error('privateDecrypt failed.', error);
    throw new Error('can not decrypt secret');
  }

  try {
    await sql.initialize({
      configDir: userDataPath,
      key: dbKey,
      logger,
    });
  } catch (error) {
    logger.error('sql initialize db with key failed', error);
    sql.onDatabaseError(error, locale.messages);
    throw error;
  }

  // reset old key to constant string
  const legacyDBKey = new LegacyDBKey(logger, userConfig);
  legacyDBKey.markUpgraded();

  return true;
});

installIpcHandler('closeDB', async () => {
  try {
    await sql.close(false);
  } catch (error) {
    console.error('close db failed.', error);
  }
});

installIpcHandler('getSecretPublicKey', async () => {
  if (dbSecret) {
    return dbSecret.getPublicKeyPem();
  }

  const publicKey = sqlConfig.get('secretPublicKey');
  const privateKey = sqlConfig.get('secretPrivateKey');

  if (publicKey && privateKey) {
    try {
      const secAux = new SecretAuxiliary(logger, userConfig, sqlConfig);
      const passphrase = secAux.read();

      dbSecret = new AsymmetricKeyManager({
        publicKey,
        privateKey,
        passphrase,
      });

      if (!dbSecret.isPrivateKeyEncrypted()) {
        sqlConfig.set('secretPrivateKey', dbSecret.getPrivateKeyPem());
      }

      return dbSecret.getPublicKeyPem();
    } catch (error) {
      console.warn('key pair in user config is not valid rsa keys.', error);
    }
  } else {
    console.log('there is no key pair in user config');
  }
});

installIpcHandler('newSecrets', async () => {
  dbSecret = await AsymmetricKeyManager.generateNewManager();

  // generate new db key
  dbNewKey = generateNewDBKey();

  return {
    publicKey: dbSecret.getPublicKeyPem(),
    secretText: dbSecret.publicEncrypt(dbNewKey),
  };
});

installIpcHandler('confirmSecrets', async publicKey => {
  if (!dbSecret) {
    throw new Error('there is no db secret instance');
  }

  const secretPublicKey = dbSecret.getPublicKeyPem();
  if (secretPublicKey !== publicKey) {
    throw new Error('provided public key is not matched with db secret.');
  }

  let backupDir;

  // backup db before confirm new key
  try {
    backupDir = await sql.backup();
  } catch (error) {
    logger.warn('back up sql error', formatError(error));
    throw new Error('failed to backup database');
  }

  const pass = dbSecret.getPassphrase();
  updateAuxiliraies(logger, userConfig, [dbNewKey, pass]);

  const secAux = new SecretAuxiliary(logger, userConfig, sqlConfig);
  secAux.save(pass);

  sqlConfig.set('secretPublicKey', secretPublicKey);
  sqlConfig.set('secretPrivateKey', dbSecret.getPrivateKeyPem());

  try {
    if (sql.isInitialized()) {
      await sql.rekey(dbNewKey);
    } else {
      await sql.initialize({ configDir: userDataPath, key: dbNewKey, logger });
    }
  } catch (error) {
    logger.warn('confirm db before save secret error', formatError(error));
    throw new Error('failed to confirm db key');
  }

  // reset old key to constant string
  const legacyDBKey = new LegacyDBKey(logger, userConfig);
  legacyDBKey.markUpgraded();

  // clear backup folder
  try {
    await fse.remove(backupDir);
  } catch (error) {
    logger.warn('failed to remove backup folder', error);
  }
});

installIpcHandler('ensureDatabaseAuxObjects', () => sql.ensureAuxObjects());

// 手动检查更新
async function manualCheckForUpdates() {
  try {
    await updater.manualCheckForUpdates(
      {
        getMainWindow,
      },
      locale.messages,
      logger
    );
  } catch (error) {
    const errorMessage = error?.message || error?.stack;

    console.log('manualCheckForUpdates exception', errorMessage);

    const options = {
      type: 'info',
      buttons: ['Ok'],
      message: errorMessage,
      defaultId: 0,
    };

    await dialog.showMessageBox(mainWindow, options);
  }
}

function setupMenu(options) {
  const { platform } = process;
  const menuOptions = Object.assign({}, options, {
    development,
    showWindow,
    showAbout,
    showSettings,
    platform,
    setupAsNewDevice,
    setupAsStandalone,
    manualCheckForUpdates,
    insiderUpdateEnabled: updater.isInsiderUpdate(),
  });
  const template = createTemplate(menuOptions, locale.messages);
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function requestShutdown() {
  if (!mainWindow || !mainWindow.webContents) {
    return;
  }

  console.log('requestShutdown: Requesting close of mainWindow...');
  const request = new Promise((resolve, reject) => {
    ipc.once('now-ready-for-shutdown', (_event, error) => {
      console.log('requestShutdown: Response received');

      if (error) {
        return reject(error);
      }

      return resolve();
    });
    mainWindow.webContents.send('get-ready-for-shutdown');

    // We'll wait two minutes, then force the app to go down. This can happen if someone
    //   exits the app before we've set everything up in preload() (so the browser isn't
    //   yet listening for these events), or if there are a whole lot of stacked-up tasks.
    // Note: two minutes is also our timeout for SQL tasks in data.js in the browser.
    setTimeout(
      () => {
        console.log(
          'requestShutdown: Response never received; forcing shutdown.'
        );
        resolve();
      },
      2 * 60 * 1000
    );
  });

  try {
    await request;
  } catch (error) {
    console.log(
      'requestShutdown error:',
      error && error.stack ? error.stack : error
    );
  }
}

app.on('before-quit', () => {
  console.log('before-quit event', {
    readyForShutdown: mainWindow ? mainWindow.readyForShutdown : null,
    shouldQuit: windowState.shouldQuit(),
  });

  windowState.markShouldQuit();
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // 偶尔会出现无法退出情况，多人语音页面直接CMD+Q
  app.quit();

  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (
    process.platform !== 'darwin' ||
    config.environment === 'test' ||
    config.environment === 'test-lib'
  ) {
    app.quit();
  }
});

app.on('activate', () => {
  if (!ready) {
    return;
  }

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow) {
    mainWindow.show();
  } else {
    // create window only is not quiting
    if (windowState.shouldQuit()) {
      console.log('app is quiting, do not re-create window when activate');
    } else {
      createWindow();
    }
  }
});

// Defense in depth. We never intend to open webviews or windows. Prevent it completely.
app.on('web-contents-created', (createEvent, contents) => {
  contents.on('will-attach-webview', attachEvent => {
    attachEvent.preventDefault();
  });
  contents.on('new-window', newEvent => {
    newEvent.preventDefault();
  });
});

let badgeCount = 0;
ipc.on('set-badge-count', (event, count) => {
  app.setBadgeCount(count);
  badgeCount = count;
});
ipc.on('query-badge-count', () => {
  if (mainWindow) {
    mainWindow.webContents.send('query-badge-count', badgeCount);
  }
});

ipc.on('remove-setup-menu-items', () => {
  setupMenu();
});

ipc.on('add-setup-menu-items', () => {
  setupMenu({
    includeSetup: true,
  });
});

ipc.on('draw-attention', () => {
  if (!mainWindow) {
    return;
  }
  if (process.platform === 'darwin') {
    // app.dock.bounce();
  } else if (process.platform === 'win32') {
    mainWindow.flashFrame(true);
  } else if (process.platform === 'linux') {
    mainWindow.flashFrame(true);
  }
});

ipc.on('restart', () => {
  app.relaunch();
  app.quit();
});

ipc.on('set-auto-hide-menu-bar', (event, autoHide) => {
  if (mainWindow) {
    mainWindow.setAutoHideMenuBar(autoHide);
  }
});

ipc.on('set-menu-bar-visibility', (event, visibility) => {
  if (mainWindow) {
    mainWindow.setMenuBarVisibility(visibility);
  }
});

ipc.on('search-user', (event, info) => {
  if (mainWindow) {
    mainWindow.webContents.send('search-user', info);
  }
});

ipc.on('search-user-reply', (event, info) => {
  if (callWindow) {
    callWindow.webContents.send('search-user', info);
  }

  incomingCallWindows.forEach(win => {
    win.webContents.send('search-user', info);
  });
});

ipc.on('close-about', () => {
  if (aboutWindow) {
    aboutWindow.close();
  }
});

ipc.on('update-tray-icon', (event, unreadCount) => {
  if (tray) {
    tray.updateIcon(unreadCount);
  }
});

// Permissions Popup-related IPC calls

ipc.on('show-permissions-popup', showPermissionsPopupWindow);
ipc.on('close-permissions-popup', () => {
  if (permissionsPopupWindow) {
    permissionsPopupWindow.close();
  }
});

// Settings-related IPC calls

function addDarkOverlay() {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('add-dark-overlay');
  }
}

function removeDarkOverlay() {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('remove-dark-overlay');
  }
}

ipc.on('show-settings', showSettings);
ipc.on('show-about', showAbout);
ipc.on('manual-check-for-updates', manualCheckForUpdates);

function showCallWindow() {
  if (callWindow) {
    callWindow.show();
  }
}

ipc.on('show-call-window', () => {
  showCallWindow();
});

installSettingsGetter('device-name');
installSettingsGetter('global-config');

installSettingsGetter('theme-setting');
installSettingsGetter('system-theme');
installSettingsSetter('theme-setting');
// installSettingsGetter('hide-menu-bar');
// installSettingsSetter('hide-menu-bar');

installSettingsGetter('notification-setting');
installSettingsSetter('notification-setting');
installSettingsGetter('audio-notification');
installSettingsSetter('audio-notification');

installSettingsGetter('spell-check');
installSettingsSetter('spell-check');

installSettingsGetter('voice-playback-speed');
installSettingsSetter('voice-playback-speed');

installSettingsGetter('quit-topic-setting');
installSettingsSetter('quit-topic-setting');

// This one is different because its single source of truth is userConfig
ipc.on('get-media-permissions', event => {
  event.sender.send(
    'get-success-media-permissions',
    null,
    userConfig.get('mediaPermissions') || false
  );
});
ipc.on('set-media-permissions', (event, value) => {
  userConfig.set('mediaPermissions', value);

  // We reinstall permissions handler to ensure that a revoked permission takes effect
  installPermissionsHandler({ session, userConfig });

  event.sender.send('set-success-media-permissions', null);
});

ipc.on('get-disable-hardware-acceleration', event => {
  event.sender.send(
    'get-success-disable-hardware-acceleration',
    null,
    userConfig.get('disableHardwareAcceleration') || false
  );
});
ipc.on('get-original-disable-hardware-acceleration', event => {
  event.sender.send(
    'get-success-original-disable-hardware-acceleration',
    null,
    disableHardware
  );
});
ipc.on('set-disable-hardware-acceleration', (event, value) => {
  userConfig.set('disableHardwareAcceleration', value);
  event.sender.send('set-success-disable-hardware-acceleration', null);
});
ipc.on('set-user-language', (event, value) => {
  userConfig.set('userLanguage', value);

  // set spell check languages
  if (OS.isLinux() || OS.isWindows()) {
    mainWindow?.webContents.session.setSpellCheckerLanguages([value]);
  }
});
ipc.on('get-language', event => {
  const result = app.getLocale() === 'zh-CN' ? 'zh-CN' : 'en';
  const language = userConfig.get('userLanguage') || result;
  event.sender.send('get-success-language', null, language);
});
ipc.on('get-original-language', event => {
  event.sender.send('get-success-original-language', null, appLocale);
});

installSettingsGetter('is-primary');
// installSettingsGetter('sync-request');
// installSettingsGetter('sync-time');
// installSettingsSetter('sync-time');

ipc.on('delete-all-data', async () => {
  const options = {
    type: 'info',
    buttons: [
      locale.messages['logout.ok'].message,
      locale.messages.cancel.message,
    ],
    message: locale.messages['logout.title'].message,
    detail: locale.messages['logout.confirmation'].message,
    defaultId: 0,
  };

  const dialogRes = await dialog.showMessageBox(mainWindow, options);
  if (dialogRes?.response === 0) {
    try {
      if (!mainWindow?.webContents) {
        throw new Error('mainWindow is not available!');
      }

      mainWindow.webContents.send('unlink-current-device');
    } catch (err) {
      console.error('logout failed', formatError(err));
      dialog.showErrorBox('Logout', 'Failed, please try again!');
    }
  }
});

function getDataFromMainWindow(name, callback) {
  ipc.once(`get-success-${name}`, (_event, error, value) =>
    callback(error, value)
  );
  mainWindow.webContents.send(`get-${name}`);
}

function installSettingsGetter(name) {
  ipc.on(`get-${name}`, event => {
    // 获取操作系统主题
    if (name === 'system-theme') {
      const contents = event.sender;
      if (contents.isDestroyed()) {
        return;
      }
      const systemTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
      contents.send(`get-success-${name}`, undefined, systemTheme);
      return;
    }

    if (mainWindow && mainWindow.webContents) {
      getDataFromMainWindow(name, (error, value) => {
        const contents = event.sender;
        if (contents.isDestroyed()) {
          return;
        }

        contents.send(`get-success-${name}`, error, value);
      });
    }
  });
}

function changeTheme(name, value) {
  globalTheme = value;
  if (mainWindow) {
    mainWindow.webContents.send(`set-${name}`, value);
  }
  if (aboutWindow) {
    aboutWindow.webContents.send(`set-${name}`, value);
  }
  if (localSearchWindow) {
    localSearchWindow.webContents.send(`set-${name}`, value);
  }

  if (imageGalleryWindow) {
    imageGalleryWindow.webContents.send(`set-${name}`, value);
  }

  Object.values(separateMessageViewerWindows).forEach(windowInfo => {
    const { win } = windowInfo;
    win?.webContents.send(`set-${name}`, value);
  });

  incomingCallWindows.forEach(win => {
    win.webContents.send(`set-${name}`, value);
  });
  if (criticalAlertWindow) {
    criticalAlertWindow.webContents.send(`set-${name}`, value);
  }
}

function installSettingsSetter(name) {
  ipc.on(`set-${name}`, (event, value) => {
    if (mainWindow && mainWindow.webContents) {
      ipc.once(`set-success-${name}`, (_event, error) => {
        const contents = event.sender;
        if (contents.isDestroyed()) {
          return;
        }

        contents.send(`set-success-${name}`, error);
      });
      mainWindow.webContents.send(`set-${name}`, value);

      if (name === 'theme-setting') {
        changeTheme(name, value);
      }
    }
  });
}

ipc.on('storage-ready-notify', async (_, theme) => {
  globalTheme = theme;

  createFloatingBarWindow();
  createSeparateMessageViewerWindowByMode({ mode: 'forward' });
  createSeparateMessageViewerWindowByMode({ mode: 'text' });
});

function isCallingExist() {
  return callWindow && callWindow.isCalling && !callWindow.isClosing;
}

ipc.handle('show-message-box', async (event, options, parent) => {
  let parentWindow;

  if (parent === 'main') {
    parentWindow = mainWindow;
  } else if (parent === 'source') {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win?.isDestroyed?.()) {
      parentWindow = win;
    }
  }

  if (parentWindow) {
    return dialog.showMessageBox(parentWindow, options);
  } else {
    return dialog.showMessageBox(options);
  }
});

ipc.handle('show-error-box', (_, title, content) => {
  dialog.showErrorBox(title, content);
});

ipc.handle('is-calling-exist', async () => {
  return isCallingExist();
});

ipc.on('browser-open-url', handleUrl);

ipc.on('freshWebApiUrlCache', async (event, info) => {
  if (info) {
    webApiUrlCache = JSON.stringify(info);
    if (callWindow) {
      await callWindowReady;
      callWindow.webContents.send('freshWebApiUrlCache', webApiUrlCache);
    }
  }
});

const CAPTIVE_PORTAL_DETECTS = [
  {
    url: 'http://captive.apple.com',
    code: 200,
    body: '<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>',
  },
  {
    url: 'http://edge-http.microsoft.com/captiveportal/generate_204',
    code: 204,
  },
  { url: 'http://www.gstatic.com/generateq_204', code: 204 },
];

async function detectCaptivePortal(detected) {
  const { url, code, body } = detected;

  let response;
  try {
    response = await fetch(url, { timeout: 30 * 1000 });
  } catch (error) {
    const err = '[detect] fetch error';
    console.log(err, formatError(error));
    throw new Error(err);
  }

  const { status } = response;
  if (status !== code) {
    const err = '[detect] reponse status does not match';
    console.log(err, status, code);
    throw new Error(err);
  }

  if (!body) {
    return;
  }

  let text;
  try {
    text = await response.textConverted();
  } catch (error) {
    const err = '[detect] convert text failed';
    console.log(err, formatError(error));
    throw new Error(err);
  }

  if (!text?.startsWith(body)) {
    const err = '[detect] response text does not match';
    console.log(err, text);
    throw new Error(err);
  }

  return;
}

let handlingBadCert = false;
const certErrorMap = {};

ipc.on('bad-self-signed-cert', async (event, host) => {
  const key = host || 'unknown';
  const certErrorList = certErrorMap[key] || [];
  if (!certErrorList.length) {
    certErrorMap[key] = certErrorList;
  }

  const now = Date.now();
  // find first index older than 2 mins
  const index = certErrorList.findIndex(time => now - time > 2 * 60 * 1000);
  const count = index === -1 ? certErrorList.length : index;
  // keep all less than 2 mins & add new
  certErrorList.splice(count);
  certErrorList.unshift(now);
  // error count less than 3, skip
  if (certErrorList.count <= 3) {
    event.returnValue = 'lower below limitation';
    return;
  }

  if (handlingBadCert) {
    event.returnValue = 'already handled';
    return;
  }

  handlingBadCert = true;

  let anyAccessable = false;
  for (const detected of CAPTIVE_PORTAL_DETECTS) {
    try {
      await detectCaptivePortal(detected);
      anyAccessable = true;
      console.log('[detect] visit captive portal success', detected.url);
      break;
    } catch (error) {
      console.log(
        '[detect] visit captive portal failed',
        formatError(error),
        detected
      );
    }
  }

  if (anyAccessable) {
    // internet connection is ok, but has certificate error.
    const options = {
      type: 'info',
      buttons: ['Ignore', 'Quit Yelling', 'Restart Yelling'],
      message: 'Network Risk Warning',
      detail: 'Application may be running under Man-in-the-middle Attack!',
      defaultId: 0,
    };
    // using sync function to block all before user take actions.
    const clickIndex = dialog.showMessageBoxSync(mainWindow, options);
    if (clickIndex === 0) {
      console.log('[detect] click ignore under risk.');
      event.returnValue = 'user clicked ignore';
      certErrorList.splice(0);
    } else if (clickIndex === 1) {
      console.log('[detect] click quit under risk.');
      event.returnValue = 'quiting';
      app.quit();
    } else {
      console.log('[detect] click restart under risk.');
      event.returnValue = 'relaunching';
      app.relaunch();
      app.quit();
    }
  } else {
    // internet connection is really bad.
    const options = {
      type: 'info',
      buttons: ['Open Browser', 'Quit Yelling', 'Restart Yelling'],
      message: 'Network Warning',
      detail:
        'The network you are using may require you to visit its login page,' +
        ' you can click "Open Browser" and continue to check the network.',
      defaultId: 0,
    };

    const { response } = await dialog.showMessageBox(mainWindow, options);
    if (response === 0) {
      console.log('[detect] click open browser.');
      event.returnValue = 'opening portal';
      const url = 'https://www.bing.com/?t=' + Date.now();
      await handleUrl(null, { target: url });
      handlingBadCert = false;
      certErrorList.splice(0);
    } else if (response === 1) {
      console.log('[detect] click quit.');
      event.returnValue = 'quiting';
      app.quit();
    } else {
      console.log('[detect] click restart.');
      event.returnValue = 'relaunching';
      app.relaunch();
      app.quit();
    }
  }
});

let imageGalleryWindow;

ipc.on('show-image-gallery', async (event, { mediaFiles, selectedIndex }) => {
  if (imageGalleryWindow) {
    imageGalleryWindow.show();
    imageGalleryWindow.webContents.send('receive-images', {
      mediaFiles,
      selectedIndex,
    });
    addSidebarItem('image-gallery', imageGalleryWindow);
    return;
  }

  const theme = globalTheme;

  const options = {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    resizable: true,
    backgroundColor: '#FFFFFF',
    show: false,
    modal: false,
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      // contextIsolation: false,
      preload: path.join(__dirname, 'image-gallery/image_gallery_preload.js'),
      enableRemoteModule: false,
      sandbox: false,
    },
    // parent: mainWindow,
    fullscreenable: false,
    minimizable: true,
    maximizable: true,

    // mac: only has the STANDARD window controls("traffic lights")
    // linux & windows: has the STANDARD title bar
    //  （There is no space to place the close button currently,
    //   so do not use CUSTOM window controls, maybe changed in the future ）
    titleBarStyle: OS.isMacOS() ? 'hidden' : 'default',

    // has NO overlay
    titleBarOverlay: false,

    acceptFirstMouse: true,
    // parent: mainWindow,
  };
  imageGalleryWindow = new BrowserWindow(options);

  // hide menu bar
  imageGalleryWindow.setMenuBarVisibility(false);

  imageGalleryWindow.loadURL(
    prepareURL([__dirname, '/image-gallery/image_gallery.html'], { theme })
  );
  imageGalleryWindow.show();
  addSidebarItem('image-gallery', imageGalleryWindow);

  imageGalleryWindow.webContents.send('receive-images', {
    mediaFiles,
    selectedIndex,
  });

  imageGalleryWindow.on('closed', () => {
    imageGalleryWindow = null;
    removeSidebarItem('image-gallery');
  });

  // Set a variable when the app is quitting.
  let isAppQuitting = false;
  app.on('before-quit', function () {
    isAppQuitting = true;
  });

  imageGalleryWindow.on('close', function (evt) {
    if (!isAppQuitting) {
      evt.preventDefault();
      imageGalleryWindow.webContents.send('close-image-window');
      imageGalleryWindow.hide();
      removeSidebarItem('image-gallery');
    }
  });
});
ipc.on('open-file-default', (e, data) => {
  if (mainWindow) {
    mainWindow.webContents.send('open-file-default', data);
  }
});

let localSearchWindow;
ipc.on('show-local-search', async (event, keywords, conversationId) => {
  if (localSearchWindow) {
    localSearchWindow.show();
    localSearchWindow.webContents.send(
      'receive-keywords',
      keywords,
      conversationId
    );
    return;
  }

  const theme = globalTheme;
  const options = {
    width: 800,
    height: 800,
    resizable: development,
    backgroundColor: '#FFFFFF',
    show: false,
    modal: false,
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: false,
      preload: path.join(__dirname, 'local_search_preload.js'),
      enableRemoteModule: false,
      sandbox: false,
    },
    // parent: mainWindow,
    fullscreenable: false,
    minimizable: true,
    maximizable: false,

    // mac: "hidden"
    //   only has the STANDARD window controls("traffic lights")
    // linux & windows: "hidden" combined with titleBarOverlay(true)
    //   it will activate the Window Controls Overlay
    //   has the CUSTOM window controls
    titleBarStyle: 'hidden',

    // has overlay for light/dark theme
    titleBarOverlay: true,

    acceptFirstMouse: true,
  };
  localSearchWindow = new BrowserWindow(options);

  // hide menu bar
  localSearchWindow.setMenuBarVisibility(false);

  localSearchWindow.loadURL(
    prepareURL([__dirname, 'local_search.html'], { theme })
  );
  localSearchWindow.once('ready-to-show', () => {
    localSearchWindow.show();
    localSearchWindow.webContents.send(
      'receive-keywords',
      keywords,
      conversationId
    );
    addSidebarItem('local-search', localSearchWindow);
  });

  localSearchWindow.on('closed', () => {
    localSearchWindow = null;
    removeSidebarItem('local-search');
  });

  if (development) {
    localSearchWindow.webContents.openDevTools();
  }
});

ipc.on('jump-message', async (event, info) => {
  if (mainWindow) {
    mainWindow.show();
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.webContents.send('jump-message', info);
  }
});

ipc.on('update-will-reboot', () => {
  markShouldQuit();
  setImmediate(() => {
    app.removeAllListeners('window-all-closed');
    autoUpdater.quitAndInstall();
  });
});

// resume from sleep
powerMonitor.on('resume', () => {
  logger.info('The computer resume from sleep.');

  if (mainWindow) {
    mainWindow.webContents.send('power-monitor-resume');
  }
});

// 阻止/取消低功耗模式
let powerSaveBlockerId;

ipc.on('low-power-mode', (_, turnOn) => {
  logger.info('main.js The low-power-mode:', turnOn);
  if (powerSaveBlockerId !== undefined) {
    powerSaveBlocker.stop(powerSaveBlockerId);
    powerSaveBlockerId = undefined;
  }

  if (turnOn) {
    powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
  }
});

// on-ac
powerMonitor.on('on-ac', () => {
  if (powerSaveBlockerId !== undefined) {
    powerSaveBlocker.stop(powerSaveBlockerId);
    powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
  }
});

// on-battery
powerMonitor.on('on-battery', () => {
  if (powerSaveBlockerId !== undefined) {
    powerSaveBlocker.stop(powerSaveBlockerId);
    powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
  }
});

nativeTheme.on('updated', () => {
  if (globalTheme === 'system') {
    changeTheme('theme-setting', 'system');
  }
});

ipc.on('meeting-get-all-contacts', () => {
  if (mainWindow) {
    mainWindow.webContents.send('meeting-get-all-contacts');
  }
});

ipc.on('reply-meeting-get-all-contacts', (_, info) => {
  if (callWindow && !callWindow.isDestroyed()) {
    callWindow.webContents.send('meeting-get-all-contacts', info);
  }
});

const checkFileSafety = fullPath => {
  const fileName = path.basename(fullPath);
  return !isFileDangerous(fileName);
};

ipc.on('ipc_showItemInFolder', function (_, fullPath) {
  if (checkFileSafety(fullPath)) {
    shell.showItemInFolder(fullPath);
  }
});

ipc.on('ipc_openPath', function (_, fullPath) {
  if (checkFileSafety(fullPath)) {
    shell.openPath(fullPath);
  }
});

function startCall(callInfo) {
  if (isCallingExist()) {
    if (callWindow.isVisible()) {
      callWindow.show();
    }
    if (callWindow.isMinimized()) {
      callWindow.restore();
    }
    return;
  }

  showLivekitCallWindow(callInfo);
}

let criticalAlertWindow = null;
const criticalAlertWindowWidth = 280;
const criticalAlertWindowHeight = 236;

function handleCriticalAlert(info) {
  const { screen } = electron;
  const theme = globalTheme;

  const options = {
    width: criticalAlertWindowWidth,
    height: criticalAlertWindowHeight,
    x: Math.floor(
      (screen.getPrimaryDisplay().workAreaSize.width -
        criticalAlertWindowWidth) /
        2
    ),
    y: Math.floor(
      (screen.getPrimaryDisplay().workAreaSize.height -
        criticalAlertWindowHeight) /
        2
    ),
    transparent: true,
    show: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: false,
      preload: path.join(__dirname, 'critical-alert/preload.js'),
      enableRemoteModule: false,
      sandbox: false,
    },
    acceptFirstMouse: true,
    frame: false,
    resizable: development,
    movable: development,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    fullscreenable: false,
  };

  criticalAlertWindow = new BrowserWindow(options);
  criticalAlertWindow.id = info.roomId || info.conversationId;

  criticalAlertWindow.loadURL(
    prepareURL([__dirname, 'critical-alert/index.html'], { ...info, theme })
  );

  criticalAlertWindow.setAlwaysOnTop(true, 'screen-saver');
  criticalAlertWindow.setVisibleOnAllWorkspaces(true);
  criticalAlertWindow.setMenuBarVisibility(false);

  criticalAlertWindow.on('closed', () => {
    // remove from map
    criticalAlertWindow = null;
  });

  criticalAlertWindow.once('ready-to-show', () => {
    if (!criticalAlertWindow) {
      return;
    }
    criticalAlertWindow.showInactive();
  });

  // if (development) {
  //   criticalAlertWindow.webContents.openDevTools();
  // }
}

// 被叫展示窗口
const incomingCallWindowWidth = 280;
const incomingCallWindowHeight = 216;
const incomingCallPadding = 8;
const incomingCallWindows = new Map();

function handleIncomingCall(info) {
  const { screen } = electron;
  const theme = globalTheme;

  const heightOffset =
    incomingCallWindows.size * (incomingCallWindowHeight + incomingCallPadding);
  const options = {
    width: incomingCallWindowWidth,
    height: incomingCallWindowHeight,
    x:
      screen.getPrimaryDisplay().size.width -
      incomingCallWindowWidth -
      incomingCallPadding, // dock在右侧时，会挤在dock边上
    y:
      screen.getPrimaryDisplay().workAreaSize.height -
      incomingCallWindowHeight -
      heightOffset,
    // autoHideMenuBar: true,
    transparent: true,
    show: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: false,
      preload: path.join(__dirname, 'livekit/incoming_call_preload.js'),
      enableRemoteModule: false,
      sandbox: false,
    },
    acceptFirstMouse: true,
    frame: false,
    resizable: development,
    movable: development,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    fullscreenable: false,
  };

  let w = new BrowserWindow(options);
  incomingCallWindows.set(info.roomId, w);
  w.loadURL(
    prepareURL([__dirname, 'livekit/incoming_call.html'], { ...info, theme })
  );

  w.setAlwaysOnTop(true, 'screen-saver');
  w.setVisibleOnAllWorkspaces(true);
  w.setMenuBarVisibility(false);

  w.on('closed', () => {
    // remove from map
    if (incomingCallWindows.has(info.roomId)) {
      incomingCallWindows.delete(info.roomId);
    }

    // reset position
    let index = 0;

    for (const item of incomingCallWindows.values()) {
      const offset = index * (incomingCallWindowHeight + incomingCallPadding);
      const [x] = item.getPosition();
      item.setPosition(
        x,
        screen.getPrimaryDisplay().workAreaSize.height -
          incomingCallWindowHeight -
          offset,
        true
      );
      index += 1;
    }
    w = null;
  });

  w.once('ready-to-show', () => {
    // 快速关闭可能会是空的
    if (!w) {
      return;
    }
    w.showInactive();
  });

  // if (development) {
  //   w.webContents.openDevTools();
  // }
}

ipc.on('dispatch-call-message', async (event, type, payload) => {
  switch (type) {
    case 'startCall': {
      startCall(payload);
      break;
    }
    case 'incomingCall': {
      const { groupId, number, roomId } = payload;
      if (
        criticalAlertWindow &&
        [groupId, number, roomId].includes(criticalAlertWindow.id)
      ) {
        console.log(
          'ignore incoming call since corresponding critical alert exist'
        );
        return;
      }
      handleIncomingCall(payload);
      break;
    }
  }
  // dispatch call messages to the meeting window
});

ipc.on('close-call-window', async _event => {
  if (callWindow) {
    callWindow.isClosing = true;
    callWindow.close();
  }
  if (floatingBarWindow) {
    floatingBarWindow.hide();
  }
  mainWindow?.webContents.send('close-add-call-members');
});

ipc.on('open-call-feedback', async (event, data) => {
  mainWindow?.webContents.send('open-call-feedback', data);
});

ipc.on('rtc-call-method', (_, info) => {
  const { event } = info;

  switch (event) {
    case 'accept': {
      // accept message
      break;
    }
    case 'reject': {
      mainWindow.webContents.send('incoming-call-respond', info);
      break;
    }
    default:
      return;
  }
});

ipc.on('join-call-from-incoming', (event, info) => {
  event.returnValue = 0;

  if (isCallingExist()) {
    callWindow.show();
    return;
  }

  setTimeout(async () => {
    showLivekitCallWindow({
      ...info,
    });
  }, 0);
});

ipc.handle('destroy-call', async (_, roomId, shouldDelay) => {
  const window = incomingCallWindows.get(roomId);
  if (window) {
    window.close();
  }
  if (callWindow) {
    callWindow.webContents.send('destroy-call', roomId, shouldDelay);
  }
});

ipc.on('want-close-self', event => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.close();
  }
});

ipc.on('open-add-call-members', async (event, callName, currentMembers) => {
  if (mainWindow) {
    mainWindow.webContents.send('open-add-call-members', {
      callName,
      currentMembers,
    });
    showWindow();
  } else {
    logger.info('main.js open-add-call-members mainWindow NOT EXIST!');
  }
});

ipc.on('add-call-members', (event, members) => {
  if (members && members.length) {
    showCallWindow();
    callWindow?.webContents.send('invite-call-members', {
      members,
    });
  }
});

ipc.handle('get-desktop-capture-sources', async (event, opts) => {
  const sources = await desktopCapturer.getSources(opts);

  return sources.map(source => ({
    id: source.id,
    name: source.name,
    appIconDataURI: source.appIcon?.toDataURL() || null,
    thumbnailDataURI: source.thumbnail?.toDataURL() || null,
  }));
});

ipc.on('resize-call-window', (_, size) => {
  if (callWindow) {
    callWindow.setSize(size.width, size.height, true);
  }
});

/**
 *
 * @param {'screen' | 'microphone' | 'camera'} mediaType
 * @returns
 */
const checkMediaPermission = mediaType => {
  if (process.platform === 'darwin') {
    const permission = systemPreferences.getMediaAccessStatus(mediaType);
    if (permission === 'denied') {
      return false;
    } else {
      return true;
    }
  } else {
    return true;
  }
};

ipc.handle('check-media-permission', async (event, mediaType) => {
  return checkMediaPermission(mediaType);
});

ipc.on('join-call-from-conversation', (event, info) => {
  if (isCallingExist()) {
    callWindow.show();
    return;
  }

  setTimeout(() => {
    showLivekitCallWindow({
      ...info,
    });
  }, 0);
});

ipc.on('add-join-call-button', (_, callInfo) => {
  mainWindow?.webContents.send('add-join-call-button', callInfo);
});

ipc.on('remove-join-call-button', (_, { roomId }) => {
  mainWindow?.webContents.send('remove-join-call-button', { roomId });
});

ipc.on('sync-call-timer', (_, callInfo) => {
  if (mainWindow) {
    mainWindow.webContents.send('sync-call-timer', callInfo);
  }
});

ipc.on('update-call-status', (event, { roomId }) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-call-status', { roomId });
  }
});

ipc.on('reject-call-by-callee', (_, roomId) => {
  if (callWindow) {
    callWindow.webContents.send('reject-call-by-callee', roomId);
  }
});

async function hideIncomingCallWindow(roomId) {
  const { promise, resolve } = Promise.withResolvers();
  if (incomingCallWindows.has(roomId)) {
    const win = incomingCallWindows.get(roomId);
    win.once('closed', () => {
      incomingCallWindows.delete(roomId);
      resolve();
    });
    win.close();
  } else {
    resolve();
  }
  return promise;
}

function hideCriticalAlertWindow() {
  if (criticalAlertWindow) {
    criticalAlertWindow.close();
    criticalAlertWindow = null;
  }
}

ipc.on('finish-join-call', (event, roomId, conversationId, timestamp) => {
  hideIncomingCallWindow(roomId);
  hideCriticalAlertWindow();
  if (mainWindow) {
    mainWindow.webContents.send('finish-join-call', conversationId, timestamp);
  }
});

ipc.handle('hide-incoming-call-window', async (event, roomId) => {
  await hideIncomingCallWindow(roomId);
});

ipc.handle('get-group-members', async (event, groupId) => {
  return new Promise(resolve => {
    ipc.once('reply-get-group-members', (event, members) => {
      resolve(members);
    });
    mainWindow.webContents.send('get-group-members', groupId);
  });
});

ipc.on('send-call-text', (event, data) => {
  if (mainWindow) {
    mainWindow.webContents.send('send-call-text', data);
  }
});

ipc.on('preload-call-window', (event, data) => {
  username = data.username;
  password = data.password;
  preloadCallWindow();
});

let floatingBarWindow;

function createFloatingBarWindow() {
  const { screen } = electron;
  const options = {
    backgroundColor: '#181a20',
    x: screen.getPrimaryDisplay().size.width / 2 - 110,
    y: screen.getPrimaryDisplay().workAreaSize.height - 350,
    width: 240,
    height: 180,
    show: false,
    // show: true,
    type: 'panel',
    hiddenInMissionControl: true,
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: false,
      preload: path.join(__dirname, 'livekit/floating_bar_preload.js'),
      enableRemoteModule: false,
      sandbox: false,
    },
    resizable: development,
    minimizable: false,
    maximizable: false,
    acceptFirstMouse: true,
    movable: true,
    alwaysOnTop: true,
    fullscreenable: false,
    frame: false,
  };
  floatingBarWindow = new BrowserWindow(options);
  floatingBarWindow.loadURL(
    prepareURL([__dirname, 'livekit/floating_bar.html'])
  );

  floatingBarWindow.setAlwaysOnTop(true, 'screen-saver');

  floatingBarWindow.setVisibleOnAllWorkspaces(true);
  floatingBarWindow.setMenuBarVisibility(false);
  floatingBarWindow.setContentProtection(true);

  floatingBarWindow.on('closed', () => {
    floatingBarWindow = null;
  });

  floatingBarWindow.on('hide', () => {
    floatingBarWindow.webContents.send('hide-window');
  });

  // if (development) {
  //   floatingBarWindow.webContents.openDevTools();
  // }
}

ipc.on('show-floating-bar', async (_, initialState) => {
  if (!floatingBarWindow) {
    return;
  }
  if (!isCallingExist()) {
    return;
  }
  if (!floatingBarWindow.isVisible()) {
    // reset before show
    floatingBarWindow.webContents.send('update-floating-bar', initialState);
    floatingBarWindow.showInactive();
  }
});

ipc.on('hide-floating-bar', () => {
  setTimeout(() => {
    if (floatingBarWindow?.isVisible?.()) {
      floatingBarWindow.hide();
    }
  }, 0);
});

ipc.on('floating-bar-hangup', () => {
  if (callWindow) {
    callWindow.webContents.send('floating-bar-hangup');
  }
});

ipc.on('floating-bar-set-muted', (event, muted) => {
  if (callWindow) {
    callWindow.webContents.send('floating-bar-set-muted', muted);
  }
});

ipc.on('update-floating-bar', (event, data) => {
  if (floatingBarWindow) {
    floatingBarWindow.webContents.send('update-floating-bar', data);
  }
});

const separateMessageViewerWindows = {
  forward: {
    win: null,
    promise: null,
    options: {
      width: 550,
      height: 580,
      mode: 'forward',
    },
  },
  text: {
    win: null,
    promise: null,
    options: {
      width: 640,
      height: 568,
      mode: 'text',
    },
  },
};

const individualWindowMap = {
  call: null,
  'local-search': null,
  'image-gallery': null,
  forward: null,
  enlarge: null,
};

function getSeparateMessageViewerCategory(mode) {
  if (mode === 'text') {
    return 'enlarge';
  } else if (mode === 'forward') {
    return 'forward';
  }
}

function addSidebarItem(category, win) {
  individualWindowMap[category] = win;
  mainWindow?.webContents.send('add-sidebar-item', { category });
}

function removeSidebarItem(category) {
  individualWindowMap[category] = null;
  mainWindow?.webContents.send('remove-sidebar-item', { category });
}

function createSeparateMessageViewerWindowByMode({ mode, messageId }) {
  const viewer = separateMessageViewerWindows[mode];
  if (!viewer) {
    throw new Error('unknow mode');
  }

  if (!viewer.win) {
    const { win, promise } = createSeparateMessageViewerWindow(viewer.options);
    viewer.win = win;
    viewer.promise = promise;
  }

  viewer.messageId = messageId;

  return viewer;
}

function createSeparateMessageViewerWindow({ height, width, mode }) {
  const { promise, resolve } = Promise.withResolvers();

  const options = {
    width,
    height,
    backgroundColor: '#1e2329',
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: false,
      preload: path.join(__dirname, 'separate-message-viewer/preload.js'),
      nativeWindowOpen: true,
      enableRemoteModule: false,
      sandbox: false,
    },
    acceptFirstMouse: true,
    frame: false,

    // has NO overlay
    titleBarOverlay: false,
    resizable: true, // Changed to allow window resizing
    show: false,
  };

  const win = new BrowserWindow(options);
  win.setMenuBarVisibility(false);

  captureClicks(win);

  const theme = globalTheme;
  const systemTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  win.loadURL(
    prepareURL([__dirname, 'separate-message-viewer/index.html'], {
      theme,
      systemTheme,
    })
  );

  const mainWindowPosition = mainWindow.getPosition();
  const mainWindowSize = mainWindow.getSize();
  const position = [
    Math.floor(mainWindowPosition[0] + (mainWindowSize[0] - width) / 2),
    Math.floor(mainWindowPosition[1] + (mainWindowSize[1] - height) / 2),
  ];
  win.setPosition(...position);

  win.webContents.on('did-finish-load', () => {
    resolve();
  });

  win.on('close', e => {
    if (windowState.shouldQuit()) {
      return;
    }
    e.preventDefault();
    win.hide();
    const category = getSeparateMessageViewerCategory(mode);
    if (category) {
      removeSidebarItem(category);
    }
  });

  // win.webContents.openDevTools();
  // separateMessageViewerWindows[mode].window = win;
  // return separateMessageViewerWindows[mode].promise;
  return { promise, win };
}

ipc.on('show-separate-view', async (event, data) => {
  const { promise, win } = createSeparateMessageViewerWindowByMode(data);
  await promise;

  win.webContents.send('update-view-data', data);
  win.show();
  if (mainWindow) {
    const category = getSeparateMessageViewerCategory(data.mode);
    if (category) {
      addSidebarItem(category, win);
    }
  }
  console.log(
    'show separate view',
    'messageId',
    data.messageId,
    'mode',
    data.mode
  );
});

ipc.on('read-confidential-message', (event, id) => {
  if (mainWindow) {
    mainWindow.webContents.send('read-confidential-message', id);
  }
});

ipc.on('open-countdown-timer-popup', () => {
  if (isCallingExist()) {
    callWindow.webContents.send('open-countdown-timer-popup');
  }
});

ipc.on('sned-frame-to-floating-bar', (event, frameInfo) => {
  if (floatingBarWindow) {
    floatingBarWindow.webContents.send('sned-frame-to-floating-bar', frameInfo);
  }
});

ipc.on('show-critical-alert', (event, info) => {
  if (criticalAlertWindow) {
    return;
  }
  handleCriticalAlert(info);
});

ipc.on('update-call-config', (event, data) => {
  if (callWindow) {
    callWindow.webContents.send('update-call-config', data);
  }
});

ipc.on('fast-join-call', (event, info) => {
  if (mainWindow) {
    mainWindow.webContents.send('fast-join-call', info);
  }
});

ipc.on('hide-critical-alert-window', (event, id) => {
  hideCriticalAlertWindow(id);
});

ipc.handle('get-message-props', async (event, messageId) => {
  const { resolve, promise } = Promise.withResolvers();

  ipc.once(`get-message-${messageId}-props-success`, (event, data) => {
    resolve(data);
  });

  mainWindow.webContents.send('get-message-props', messageId);

  return promise;
});

ipc.on('require-screen-share-action', (event, data) => {
  if (callWindow) {
    callWindow.webContents.send('require-screen-share-action', data);
  }
});

ipc.on('set-title-bar-overlay', (event, overlay) => {
  try {
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);
    win.setTitleBarOverlay(overlay);
  } catch (error) {
    console.log('set-title-bar-overlay error', error);
  }
});

ipc.on('force-update-alert', async event => {
  try {
    const options = {
      type: 'error',
      buttons: [locale.messages['downloadTooltip'].message],
      message: locale.messages['forceUpdateLatestVersion'].message,
      detail: '',
    };

    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);

    await dialog.showMessageBox(win, options);

    handleUrl(null, { target: 'https://yelling.pro' });

    console.log('want quit!');
    app.quit();
  } catch (error) {
    console.log('force-update-alert error', error);
  }
});

ipc.on('show-individual-window', (event, category) => {
  const win = individualWindowMap[category];
  if (win) {
    win.show();
  }
});
