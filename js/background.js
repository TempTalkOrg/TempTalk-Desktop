/* global
  $,
  _,
  Backbone,
  ConversationController,
  getAccountManager,
  Signal,
  storage,
  textsecure,
  Whisper,
  watermark,
*/

const MAC_MEETINGVERSION = 3;
const LINUX_MEETINGVERSION = 1;
// 设置meetingVersion
const meetingVersion = window.Signal.OS.isMacOS()
  ? MAC_MEETINGVERSION
  : LINUX_MEETINGVERSION;

window.setupWaterMark = () => {
  'use strict';

  let user = storage.get('number_id');
  if (user) {
    user = user.replace('+', '');
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

function generateGroupAvatar(items, sizePx = 512) {
  const backgroundColors = _.shuffle([
    'rgb(255,69,58)',
    'rgb(255,159,11)',
    'rgb(254,215,9)',
    'rgb(49,209,91)',
    'rgb(120,195,255)',
    'rgb(11,132,255)',
    'rgb(94,92,230)',
    'rgb(213,127,245)',
    'rgb(114,126,135)',
    'rgb(255,79,121)',
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get 2D rendering context');
  }

  const centerX = sizePx / 2;
  const centerY = sizePx / 2;
  const padding = sizePx * 0.04; // Consistent padding

  const backgroundColor = backgroundColors[items.length];
  // 1. Background Circle
  ctx.fillStyle = backgroundColor;
  ctx.beginPath();
  ctx.arc(centerX, centerY, sizePx / 2, 0, 2 * Math.PI);
  ctx.fill();

  const count = items.length;

  if (count === 0) {
    // Return background color only if no valid items
    return canvas.toDataURL('image/png');
  }

  // 2. Calculate Sizes
  let circleRadius;
  switch (count) {
    case 1:
      circleRadius = sizePx * 0.38;
      break;
    case 2:
      circleRadius = sizePx * 0.24;
      break;
    case 3:
      circleRadius = sizePx * 0.22;
      break;
    case 4:
      circleRadius = sizePx * 0.2;
      break;
    case 5:
      circleRadius = sizePx * 0.18;
      break;
    default:
      circleRadius = sizePx * 0.16; // 6 items
  }

  const layoutRadius = sizePx / 2 - padding - circleRadius;

  // 3. Calculate Positions
  let positions = [];
  if (count === 1) {
    positions = [{ x: centerX, y: centerY }];
  } else if (count === 2) {
    // Special case for 2 items: horizontally centered
    const offsetX = layoutRadius * 0.85;
    positions = [
      { x: centerX - offsetX, y: centerY },
      { x: centerX + offsetX, y: centerY },
    ];
  } else {
    // 3 to 6 items: arranged in a circle
    const angleStep = (2 * Math.PI) / count; // Radians
    const startAngle = -Math.PI / 2; // Start at the top (-90 degrees)
    for (let i = 0; i < count; i++) {
      const angle = startAngle + i * angleStep;
      const x = centerX + layoutRadius * Math.cos(angle);
      const y = centerY + layoutRadius * Math.sin(angle);
      positions.push({ x, y });
    }
  }

  // 4. Draw Items (Circles and Text)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle'; // Simplifies vertical centering

  items.forEach((item, index) => {
    const { x: cx, y: cy } = positions[index];
    const charToDraw = item.charAt(0).toUpperCase();

    // Draw background circle for the letter
    ctx.fillStyle = backgroundColors[index];
    ctx.beginPath();
    ctx.arc(cx, cy, circleRadius, 0, 2 * Math.PI);
    ctx.fill();

    // Draw text
    ctx.fillStyle = '#FFFFFF'; // White text
    // Set font size relative to circle size. Adjust font family as needed.
    ctx.font = `bold ${circleRadius * 0.9}px Arial, sans-serif`;
    ctx.fillText(charToDraw, cx, cy);
  });

  // 6. Return data URL
  return canvas.toDataURL('image/png');
}

const makeMessageCollapseId = ({ timestamp, source, sourceDevice }) => {
  const combined = `${timestamp}${source}${sourceDevice}`;

  const data = new TextEncoder().encode(combined);
  const md5Buffer = window.digestMD5(data);
  const collapseId = md5Buffer.toString('hex');

  // return lower case
  return collapseId;
};

// eslint-disable-next-line func-names
(async function () {
  'use strict';

  // Globally disable drag and drop
  document.body.addEventListener(
    'dragover',
    e => {
      e.preventDefault();
      e.stopPropagation();
    },
    false
  );
  document.body.addEventListener(
    'drop',
    e => {
      e.preventDefault();
      e.stopPropagation();
    },
    false
  );

  // Load these images now to ensure that they don't flicker on first use
  const images = [];

  function preload(list) {
    for (let index = 0, max = list.length; index < max; index += 1) {
      const image = new Image();
      image.src = `./images/${list[index]}`;
      images.push(image);
    }
  }

  preload([
    'alert-outline.svg',
    'android.svg',
    'apple.svg',
    'audio.svg',
    'back.svg',
    'chat-bubble-outline.svg',
    'chat-bubble.svg',
    'check-circle-outline.svg',
    'check.svg',
    'clock.svg',
    'close-circle.svg',
    'complete.svg',
    'delete.svg',
    'dots-horizontal.svg',
    'double-check.svg',
    'download.svg',
    'ellipsis.svg',
    'error.svg',
    'error_red.svg',
    'file-gradient.svg',
    'file.svg',
    'forward.svg',
    'gear.svg',
    'group-chats.svg',
    'group_default.png',
    'hourglass_empty.svg',
    'hourglass_full.svg',
    'icon_128.png',
    'icon_16.png',
    'icon_256.png',
    'icon_32.png',
    'icon_48.png',
    'image.svg',
    'import.svg',
    'lead-pencil.svg',
    'menu.svg',
    'movie.svg',
    'open_link.svg',
    'play.svg',
    'plus.svg',
    'plus-36.svg',
    'read.svg',
    'reply.svg',
    'save.svg',
    'search.svg',
    'sending.svg',
    'shield.svg',
    'sync.svg',
    'timer-00.svg',
    'timer-05.svg',
    'timer-10.svg',
    'timer-15.svg',
    'timer-20.svg',
    'timer-25.svg',
    'timer-30.svg',
    'timer-35.svg',
    'timer-40.svg',
    'timer-45.svg',
    'timer-50.svg',
    'timer-55.svg',
    'timer-60.svg',
    'timer.svg',
    'video.svg',
    'voice.svg',
    'warning.svg',
    'x.svg',
    'x_white.svg',
    'LOGO.svg',
    'tabbar_difft.svg',
    'tabbar_difft_blue.svg',
    'tabbar_contact.svg',
    'tabbar_contact_blue.svg',
    'tabbar_task.svg',
    'tabbar_task_blue.svg',
    'tabbar_calendar.svg',
    'tabbar_setting.svg',
    'task-close-hover.png',
  ]);

  // We add this to window here because the default Node context is erased at the end
  //   of preload.js processing
  window.setImmediate = window.nodeSetImmediate;

  const { IdleDetector, MessageDataMigrator } = Signal.Workflow;
  const { Errors, Message, APIStatus } = window.Signal.Types;
  const { upgradeMessageSchema } = window.Signal.Migrations;
  const { Views } = window.Signal;
  const { generateServiceConfig } = window.Signal.Network;

  window.log.info('background page reloaded');
  window.log.info('environment:', window.getEnvironment());

  let idleDetector;
  let initialLoadComplete = false;
  let newVersion = false;
  let offlineMessageLoaded = false;

  window.isOfflineMessageLoaded = () => offlineMessageLoaded;

  window.owsDesktopApp = {};
  window.document.title = window.getTitle();

  // start a background worker for ecc
  textsecure.startWorker('js/libsignal-protocol-worker.js');

  let messageReceiver;
  window.getSocketStatus = () => {
    if (messageReceiver) {
      return messageReceiver.getStatus();
    }
    return -1;
  };
  Whisper.events = _.clone(Backbone.Events);

  let outerRequest;
  window.getOuterRequest = () => {
    if (!outerRequest) {
      outerRequest = new textsecure.OuterRequest();
    }

    return outerRequest;
  };

  let accountManager;
  window.getAccountManager = () => {
    if (!accountManager) {
      const USERNAME = storage.get('number_id');
      const PASSWORD = storage.get('password');
      accountManager = new textsecure.AccountManager(USERNAME, PASSWORD);
      accountManager.addEventListener('registration', () => {
        const user = {
          regionCode: window.storage.get('regionCode'),
          ourNumber: textsecure.storage.user.getNumber(),
        };
        Whisper.events.trigger('userChanged', user);

        Whisper.Registration.markDone();
        window.log.info('dispatching registration event');
        Whisper.events.trigger('registration_done');
      });
    }
    return accountManager;
  };

  const showOptimizingMessage = () =>
    Views.Initialization.setMessage(window.i18n('optimizingApplication'));

  const cancelInitializationMessage = Views.Initialization.setMessage();

  const regenerateServiceConfig = generateServiceConfig();
  window.selectBestDomain = (testSpeed = true) => {
    regenerateServiceConfig(window.globalConfig, testSpeed);
  };

  // localStorage 不存在 serviceConfig 时，先生成一份未测速的提供使用
  if (_.isEmpty(window.getGlobalWebApiUrls())) {
    window.selectBestDomain(false);
  }

  const initilize = async () => {
    Views.Initialization.setMessage(window.i18n('connecting') + ' ...');

    try {
      await window.tryToInitDatabase();

      window.log.info('Initilize database successfully in background.');
    } catch (error) {
      const { name } = error;
      if (name === 'NoPermissionError') {
        // forbidden by server
        // should lock app
        window.log.info(
          'No permission to open database.',
          Errors.toLogFormat(error)
        );
        Views.Initialization.setMessage(window.i18n('lockedDeviceWarning'));
      } else if (
        name === 'NotMatchedSecretError' ||
        name === 'InvalidKeyPairsError'
      ) {
        // retrived key is not for current db anymore
        // should alert and quit
        window.log.info('Database error.', Errors.toLogFormat(error));
        Views.Initialization.setMessage(window.i18n('notMatchedKeyWarning'));
      } else {
        window.log.info('Network error.', Errors.toLogFormat(error));

        let timeout = 10;
        if (name === 'RateLimitExceededError') {
          timeout = 30;
        }

        // may network error
        // should retry later
        Views.Initialization.setMessage(
          window.i18n('networkErrAndRetry', timeout)
        );

        // retry in timeout seconds
        setTimeout(initilize, timeout * 1000);
      }
      return;
    }

    if (window.hasDBInitialized()) {
      window.log.info('Storage fetch');
      storage.fetch();
    } else {
      // db is not initialized
      log.warn('db is not initilized.');
    }
  };

  await initilize();

  // We need this 'first' check because we don't want to start the app up any other time
  //   than the first time. And storage.fetch() will cause onready() to fire.
  let first = true;
  storage.onready(async () => {
    if (!first) {
      return;
    }
    first = false;

    // 定义更新名字函数
    window.updateName = async name => {
      // const nameLengthMax = 30;
      window.log.info('updateName name:', name);
      if (!name) {
        window.log.error('updateName name is empty.');
        alert(i18n('changeNameCannotBeEmpty'));
        return;
      }

      try {
        const res = await window.getAccountManager().setProfile({ name });
        // 特殊字符
        if (res && res.status === 10100) {
          alert(i18n('changeNameUnsupportedChars'));
          return;
        }
        // 格式不正确
        if (res && res.status === 10101) {
          alert(i18n('changeNameBadFormat', res.reason));
          return;
        }
        // 名字太长了
        if (res && res.status === 10102) {
          alert(i18n('changeNameTooLong'));
          return;
        }
        // 名字已存在
        if (res && res.status === 10103) {
          alert(i18n('changeNameAlreadyExist'));
          return;
        }
        // 实习生不允许改名
        if (res && res.status === 10104) {
          alert(i18n('changeNameInterError'));
          return;
        }
        // 其他情况
        if (!res || res.status !== 0) {
          alert(i18n('changeNameOtherError'));
          return;
        }

        // 更新
        const ourNumber = textsecure.storage.user.getNumber();
        const conversation = ConversationController.get(ourNumber);
        conversation.set({ name });
        await window.Signal.Data.updateConversation(conversation.attributes);
        return true;
      } catch (e) {
        window.log.error('updateName error', e);
        setImmediate(() => {
          const { code } = e || {};
          switch (code) {
            case 403:
              alert(i18n('forbiddenOperation'));
              return;
            case 413:
              alert(i18n('profile_too_frequent'));
              return;
          }
        });
      }
    };

    // 定义更新签名方法
    window.updateSignature = async signature => {
      const signLengthMax = 80;

      window.log.info('updateSignature signature:', signature);
      if (signature && signature.length > signLengthMax) {
        window.log.error('updateSignature param too long.');
        return;
      }
      try {
        await window
          .getAccountManager()
          .setProfile({ signature: signature || '' });

        // 更新
        const ourNumber = textsecure.storage.user.getNumber();
        const conversation = ConversationController.get(ourNumber);
        conversation.set({ signature: signature || '' });
        await window.Signal.Data.updateConversation(conversation.attributes);
        return true;
      } catch (e) {
        window.log.error('updateSignature error', e);
        setImmediate(() => {
          if (e && e.code === 413) {
            alert(i18n('profile_too_frequent'));
            return;
          }
          alert('Update signature error:' + e?.message);
        });
      }
    };

    // 上传（更新）群头像
    window.uploadGroupAvatar = async (imageDataStr, groupConversationId) => {
      let imageData = imageDataStr;
      if (
        imageData.startsWith('data:image') &&
        imageData.includes(';base64,')
      ) {
        const pos = imageData.indexOf(';base64,');
        imageData = imageData.substr(pos + 8);
      }
      const avatar = window.Signal.Crypto.base64ToArrayBuffer(imageData);
      const imageByteCount = avatar.byteLength;

      // encrypt
      const keys = libsignal.crypto.getRandomBytes(64);
      const encryptedGroupAvatarBin = await textsecure.crypto.encryptAttachment(
        avatar,
        keys,
        libsignal.crypto.getRandomBytes(16),
        32
      );

      const key = window.Signal.Crypto.arrayBufferToBase64(keys);
      const digest = window.Signal.Crypto.arrayBufferToBase64(
        encryptedGroupAvatarBin.digest
      );

      const conversation = ConversationController.get(groupConversationId);
      if (conversation) {
        await conversation.updateGroupAvatar(
          { id: '', uploadData: avatar, digest, key, size: imageByteCount },
          encryptedGroupAvatarBin.ciphertext,
          key,
          digest,
          imageByteCount
        );

        const groupUpdate = {
          avatar: avatar,
        };
        await conversation.updateGroup(groupUpdate);
      }
    };

    // 上传（更新）个人头像
    window.uploadAvatar = async imageDataStr => {
      try {
        let imageData = imageDataStr;
        if (
          imageData.startsWith('data:image') &&
          imageData.includes(';base64,')
        ) {
          const pos = imageData.indexOf(';base64,');
          imageData = imageData.substr(pos + 8);
        }

        const avatar = window.Signal.Crypto.base64ToArrayBuffer(imageData);
        let key;
        const pk = textsecure.storage.get('profileKey');
        if (pk && pk.byteLength === 32) {
          key = pk;
        } else {
          key = window.getGuid().replace(/-/g, '');
        }

        // encrypt
        const encryptedBin = await textsecure.crypto.encryptProfile(
          avatar,
          window.Signal.Crypto.bytesFromString(key)
        );

        // get oss url
        const ossInfo = await window.getAccountManager().getAvatarUploadId();

        // upload avatar
        const b64Key = window.Signal.Crypto.arrayBufferToBase64(key);
        await window
          .getAccountManager()
          .putAvatar(
            ossInfo.location,
            encryptedBin,
            ossInfo.idString,
            'AESGCM256',
            b64Key
          );

        // success，update local
        const conversation = ConversationController.get(
          textsecure.storage.user.getNumber()
        );
        if (conversation) {
          conversation.updatePrivateAvatar({
            attachmentId: ossInfo.idString,
            uploadData: avatar,
          });
        }
      } catch (e) {
        window.log.error('update avatar error', e);
        setImmediate(() => {
          if (e && e.code === 413) {
            alert(i18n('profile_too_frequent'));
            return;
          }
          alert('Update avatar error:' + e?.message);
        });
      }
    };

    // set Group Notify Type
    window.setGroupNotifyType = async (type, cid, ourNumber) => {
      window.Signal.ID.convertIdToV2(cid);
      const conversation = window.ConversationController.get(cid);
      await conversation.apiEditGroupV2Member(ourNumber, {
        notification: type,
      });

      //更新 MainMenu 的未读消息数量
      window.getInboxCollection().updateUnreadCount();
    };

    // These make key operations available to IPC handlers created in preload.js
    window.Events = {
      getDeviceName: () => textsecure.storage.user.getDeviceName(),

      getThemeSetting: () => storage.get('theme-setting', 'system'),
      setThemeSetting: value => {
        storage.put('theme-setting', value);
        onChangeTheme();
      },
      // getHideMenuBar: () => storage.get('hide-menu-bar'),
      // setHideMenuBar: value => {
      //   storage.put('hide-menu-bar', value);
      //   window.setAutoHideMenuBar(value);
      //   window.setMenuBarVisibility(!value);
      // },

      getNotificationSetting: () =>
        storage.get('notification-setting', 'message'),
      setNotificationSetting: value =>
        storage.put('notification-setting', value),
      getAudioNotification: () => storage.get('audio-notification'),
      setAudioNotification: value => storage.put('audio-notification', value),

      getSpellCheck: () => storage.get('spell-check', false),
      setSpellCheck: value => {
        storage.put('spell-check', value);
        startSpellCheck();
      },
      getQuitTopicSetting: () => storage.get('quit-topic-setting', true),
      setQuitTopicSetting: value => {
        storage.put('quit-topic-setting', value);
      },

      // eslint-disable-next-line eqeqeq
      isPrimary: () => textsecure.storage.user.getDeviceId() == '1',

      addDarkOverlay: () => {
        if ($('.dark-overlay').length) {
          return;
        }
        $(document.body).prepend('<div class="dark-overlay"></div>');
        $('.dark-overlay').on('click', () => $('.dark-overlay').remove());
      },
      removeDarkOverlay: () => $('.dark-overlay').remove(),

      shutdown: async () => {
        // Stop background processing
        window.Signal.AttachmentDownloads.stop();
        if (idleDetector) {
          idleDetector.stop();
        }

        // Stop processing incoming messages
        if (messageReceiver) {
          await messageReceiver.stopProcessing();
          await window.waitForAllBatchers();
        }

        if (messageReceiver) {
          messageReceiver.unregisterBatchers();
          messageReceiver = null;
        }

        // Shut down the data interface cleanly
        await window.Signal.Data.shutdown();
      },
      getGlobalConfig: () => window.getGlobalConfig(),
    };

    if (
      window.isDBLegacyInitilized ||
      textsecure.storage.get('should-upgrade-db-key')
    ) {
      // try to call web api to detect whether logout or not
      try {
        await window.getAccountManager().getDevices();

        // do not link with device info now
        await window.uploadSecretDBKey(undefined, showOptimizingMessage);

        // mark as upgraded
        await textsecure.storage.remove('should-upgrade-db-key');
      } catch (error) {
        log.warn('upgrade db failed:', Errors.toLogFormat(error));
      }
    }

    const currentVersion = window.getVersion();
    const lastVersion = storage.get('version');
    newVersion = !lastVersion || currentVersion !== lastVersion;
    await storage.put('version', currentVersion);

    showOptimizingMessage();

    if (newVersion) {
      window.log.info(
        `Newer installed version detected: ${currentVersion}; previous: ${lastVersion}`
      );

      try {
        await window.Signal.Data.rebuildMessagesIndexesIfNotExists();
      } catch (error) {
        window.log.error(
          'rebuildMessagesIndexesIfNotExists failed,',
          error && error.stack ? error.stack : error
        );
      }

      try {
        await window.Signal.Data.rebuildMessagesTriggersIfNotExists();
      } catch (error) {
        window.log.error(
          'rebuildMessagesTriggersIfNotExists failed,',
          error && error.stack ? error.stack : error
        );
      }

      try {
        // cleanup orphaned attachments
        await window.Signal.Data.cleanupOrphanedAttachments();
      } catch (error) {
        window.log.error(
          'cleanupOrphanedAttachments error,',
          error && error.stack ? error.stack : error
        );
      }
    }

    Views.Initialization.setMessage(window.i18n('loading'));

    idleDetector = new IdleDetector();
    let isMigrationProcessing = false;
    let isMigrationWithIndexComplete = false;
    window.log.info(
      `Starting background data migration. Target version: ${Message.CURRENT_SCHEMA_VERSION}`
    );
    idleDetector.on('idle', async () => {
      window.log.info('Starting idle handler.');

      const NUM_MESSAGES_PER_BATCH = 1;

      if (!isMigrationWithIndexComplete) {
        if (isMigrationProcessing) {
          window.log.info('Duplicated idle handler, just skip.');
          return;
        }

        isMigrationProcessing = true;

        const batchWithIndex = await MessageDataMigrator.processNext({
          BackboneMessage: Whisper.Message,
          BackboneMessageCollection: Whisper.MessageCollection,
          numMessagesPerBatch: NUM_MESSAGES_PER_BATCH,
          upgradeMessageSchema,
          getMessagesNeedingUpgrade:
            window.Signal.Data.getMessagesNeedingUpgrade,
          saveMessage: window.Signal.Data.saveMessage,
        });

        window.log.info('Upgrade message schema (with index):', batchWithIndex);

        isMigrationWithIndexComplete = batchWithIndex.done;
        isMigrationProcessing = false;
      }

      if (isMigrationWithIndexComplete) {
        window.log.info(
          'Background migration complete. Stopping idle detector.'
        );
        idleDetector.stop();
      }
    });

    const startSpellCheck = () => {
      window.log.info('Starting spell check configuration.');

      const enabled = !!window.Events.getSpellCheck();
      $('.send-message').prop('spellcheck', enabled);

      window.log.info('Spell check configuration Complete ', enabled);
    };

    const themeSetting = window.Events.getThemeSetting();
    window.storageReadyNotify(themeSetting);
    window.Events.setThemeSetting(themeSetting);

    try {
      await Promise.all([
        ConversationController.load(),
        textsecure.storage.protocol.hydrateCaches(),
      ]);
    } catch (error) {
      window.log.error(
        'background.js: ConversationController failed to load:',
        error && error.stack ? error.stack : error
      );
    } finally {
      start();
    }
  });

  Whisper.events.on('setupAsNewDevice', () => {
    const { appView } = window.owsDesktopApp;
    if (appView) {
      appView.openInstaller();
    }
  });

  Whisper.events.on('setupAsStandalone', () => {
    const { appView } = window.owsDesktopApp;
    if (appView) {
      appView.openStandalone();
    }
  });

  function openCallFeedback(callInfoData) {
    if (window.callFeedbackView) {
      return;
    }
    window.callFeedbackView = new window.Whisper.ReactWrapperView({
      Component: window.Signal.Components.CallFeedback,
      props: {
        i18n,
        open: true,
        onCancel() {
          window.callFeedbackView.remove();
          window.callFeedbackView = null;
        },
        async onSubmit(userData) {
          try {
            const data = {
              ...callInfoData,
              ...userData,
            };
            await window.callAPI.submitCallFeedback(data);
          } catch (error) {
            window.log.error('submit call feedback error', error);
          }
          window.callFeedbackView.remove();
          window.callFeedbackView = null;
        },
      },
    });

    document.body.appendChild(window.callFeedbackView.el);
  }

  let openCallFeedbackDate = localStorage.getItem('openCallFeedbackDate');
  let openCallFeedbackFlag =
    openCallFeedbackDate === moment().format('YYYYMMDD')
      ? localStorage.getItem('openCallFeedbackFlag')
      : false;
  let openCallFeedbackThreshold = 0.2;

  Whisper.events.on('open-call-feedback', data => {
    try {
      const today = moment().format('YYYYMMDD');
      // init or reset
      if (!openCallFeedbackDate || openCallFeedbackDate !== today) {
        openCallFeedbackDate = today;
        localStorage.setItem('openCallFeedbackDate', today);
        openCallFeedbackFlag = false;
        localStorage.setItem('openCallFeedbackFlag', false);
        openCallFeedbackThreshold = 0.2;
      }

      if (openCallFeedbackFlag) {
        console.log('already opened call feedback today');
        return;
      }

      if (Math.random() < openCallFeedbackThreshold) {
        openCallFeedback(data);
        openCallFeedbackFlag = true;
        localStorage.setItem('openCallFeedbackFlag', true);
      } else {
        openCallFeedbackThreshold += 0.2;
      }
    } catch (e) {
      window.log.error('open call feedback error', e);
    }
  });

  // define connectCount before connect() was called.
  let connectCount = 0;
  const incomingCallMap = new Map();

  async function start() {
    window.dispatchEvent(new Event('storage_ready'));

    window.log.info('Cleanup: starting...');
    const messagesForCleanup =
      await window.Signal.Data.getOutgoingWithoutExpiresAt({
        MessageCollection: Whisper.MessageCollection,
      });
    window.log.info(
      `Cleanup: Found ${messagesForCleanup.length} messages for cleanup`
    );
    await Promise.all(
      messagesForCleanup.map(async message => {
        const delivered = message.get('delivered');
        const sentAt = message.get('sent_at');
        const expirationStartTimestamp = message.get(
          'expirationStartTimestamp'
        );

        if (message.hasErrors()) {
          return;
        }

        if (delivered) {
          window.log.info(
            `Cleanup: Starting timer for delivered message ${sentAt}`
          );
          message.set(
            'expirationStartTimestamp',
            expirationStartTimestamp || sentAt
          );
          await message.setToExpire();
          return;
        }

        window.log.info(`Cleanup: Deleting unsent message ${sentAt}`);
        await window.Signal.Data.removeMessage(message.id, {
          Message: Whisper.Message,
        });
        const conversation = message.getConversation();
        if (conversation) {
          conversation.debouncedUpdateLastMessage();
        }
      })
    );
    window.log.info('Cleanup: complete');

    // correct history messages with improper expireTimer
    if (newVersion) {
      try {
        const relatedSet = new Set();
        const ourNumber = textsecure.storage.user.getNumber();
        do {
          if (!ourNumber) {
            break;
          }

          const messages =
            await window.Signal.Data.getNextMessagesToCorrectTimer(ourNumber, {
              limit: 50,
              Message: Whisper.Message,
            });
          if (!messages?.length) {
            log.info('there is no message to correct timer');
            break;
          }

          log.info('correct timer for messages of count:', messages.length);

          for (const message of messages) {
            let expireTimer;

            const conversation = message.getConversation();
            if (conversation) {
              expireTimer = conversation.getConversationMessageExpiry();
              relatedSet.add(conversation);
            } else {
              const globalConfig = window.getGlobalConfig();
              // expireTimer default to 7days (seconds)
              expireTimer =
                globalConfig?.disappearanceTimeInterval?.message?.default ||
                7 * 24 * 60 * 60;
            }

            message.set({ expireTimer });
          }

          do {
            const items = messages.splice(0, 10);
            if (!items.length) {
              break;
            }

            await window.Signal.Data.saveMessages(
              items.map(item => item.attributes)
            );
          } while (messages.length);
        } while (true);

        for (const conversation of relatedSet) {
          await conversation.debouncedUpdateLastMessage();
        }
      } catch (error) {
        log.error('correct message timer failed', Errors.toLogFormat(error));
      }
    }

    await Whisper.Recalls.loadByDB();

    window.log.info('listening for registration events');
    Whisper.events.on('registration_done', async () => {
      window.log.info('handling registration event');

      if (
        window.isDBLegacyInitilized ||
        textsecure.storage.get('should-upgrade-db-key')
      ) {
        // legacy initialized or different user logged in
        try {
          await window.uploadSecretDBKey();

          // mark as upgraded
          await textsecure.storage.remove('should-upgrade-db-key');
        } catch (error) {
          window.log.warn(
            'upgrade db failed after registration:',
            Errors.toLogFormat(error)
          );
        }
      } else {
        // do nothing
      }

      // set theme if needed
      if (!storage.get('theme-setting')) {
        storage.put('theme-setting', window.getSystemTheme());
        onChangeTheme();
      }

      // open inbox
      if (appView.installView || appView.standaloneView) {
        appView.openInbox();
      }

      connect(true);
    });

    cancelInitializationMessage();
    const appView = new Whisper.AppView({
      el: $('body'),
    });
    window.owsDesktopApp.appView = appView;

    Whisper.WallClockListener.init(Whisper.events);
    Whisper.ExpiringMessagesListener.init(Whisper.events);

    // 已经清理掉密码，直接跳到扫码登录页面
    if (!storage.get('number_id') || !storage.get('password')) {
      appView.openInstaller();
    } else if (Whisper.Registration.everDone()) {
      connect();
      appView.openInbox({
        initialLoadComplete,
      });
    } else {
      appView.openInstaller();
    }
    Whisper.events.on('unauthorized', () => {
      appView.inboxView.networkStatusView.update();
    });
    Whisper.events.on('reconnectTimer', millis => {
      appView.inboxView.networkStatusView.onReconnectTimer(millis);
    });
    window.addEventListener('focus', () => Whisper.Notifications.clear());
    window.addEventListener('beforeunload', () =>
      Whisper.Notifications.fastClear()
    );

    let lastOpenedId;
    //记录会话来源
    window.conversationFrom;
    Whisper.events.on(
      'showConversation',
      (
        id,
        messageId,
        recentConversationSwitch,
        type,
        conversationFrom = null
      ) => {
        if (lastOpenedId && lastOpenedId != id) {
          const conversation = ConversationController.get(lastOpenedId);
          window.conversationFrom = {
            id: conversation.id,
            type: 'fromGroup',
            isSend: !conversation.isPrivate(),
          };
          if (conversation) {
            conversation.clearReadConfidentialMessages();
          }
        }
        //追加会话来源
        if (conversationFrom) {
          window.conversationFrom = conversationFrom;
        }

        // update
        lastOpenedId = id;

        if (appView) {
          appView.openConversation(
            id,
            messageId,
            recentConversationSwitch,
            type
          );
        }
      }
    );

    Whisper.events.on('showGroupChats', () => {
      if (appView) {
        appView.openGroupChats();
      }
    });

    Whisper.events.on('showAllBots', () => {
      if (appView) {
        appView.openAllBots();
      }
    });

    Whisper.events.on('deleteMessages', (id, type) => {
      if (appView) {
        appView.deleteMessages(id, type);
      }
    });

    Whisper.events.on('conversationStick', (id, stick) => {
      if (appView) {
        appView.conversationStick(id, stick);
      }
    });

    Whisper.events.on('conversationMute', (id, mute) => {
      if (appView) {
        appView.conversationMute(id, mute);
      }
    });
    Whisper.events.on('conversationLeaveGroup', id => {
      if (appView) {
        appView.conversationLeaveGroup(id);
      }
    });
    Whisper.events.on('conversationDisbandGroup', id => {
      if (appView) {
        appView.conversationDisbandGroup(id);
      }
    });

    Whisper.events.on('conversationArchived', id => {
      if (appView) {
        appView.conversationArchived(id);
      }
    });

    Whisper.Notifications.on('click', (id, messageId) => {
      window.showWindow();
      if (id) {
        appView.openConversation(id, messageId);
      } else {
        appView.openInbox({
          initialLoadComplete,
        });
      }
    });

    Whisper.events.on('create-or-edit-group', async (fromWinId, editInfo) => {
      const { mode, groupInfo } = editInfo;

      log.info('create-or-edit-group, fromWindowId:' + fromWinId);

      let result;

      if (mode === 'new-group') {
        result = await createGroupV2(groupInfo);
        if (!result.result) {
          Whisper.events.trigger('result-of-create-or-edit', false);
          alert(result.errorMessage);
        } else {
          Whisper.events.trigger('result-of-create-or-edit', true);
          // open new conversation
          Whisper.events.trigger('showConversation', result.groupId);
          const memberAccountNames = groupInfo.members.slice(0, 6).map(id => {
            const conversation = ConversationController.get(id);
            if (!conversation) {
              return '#';
            }
            return conversation.getAccountName();
          });
          const imageB64 = generateGroupAvatar(memberAccountNames);
          window.uploadGroupAvatar(imageB64, result.groupId);
        }
      } else if (mode === 'add-group-members') {
        result = await addMembersV2(groupInfo);
        Whisper.events.trigger('result-of-create-or-edit', result.result);
        if (!result.result) {
          alert(result.errorMessage);
        }
      } else if (mode === 'remove-group-members') {
        result = await removeMembersV2(groupInfo);
        Whisper.events.trigger('result-of-create-or-edit', result.result);
        if (!result.result) {
          alert(window.i18n('group_editor_remove_members_failed'));
        }
      } else if (mode === 'add-group-admins') {
        result = await moveAdmins(groupInfo, true);
        Whisper.events.trigger('result-of-create-or-edit', result.result);
        if (!result.result) {
          alert(window.i18n('group_editor_add_admin_failed'));
        }
      } else if (mode === 'remove-group-admins') {
        result = await moveAdmins(groupInfo, false);
        Whisper.events.trigger('result-of-create-or-edit', result.result);
        if (!result.result) {
          alert(window.i18n('group_editor_remove_admin_failed'));
        }
      }

      // sendGroupOperationResult(fromWinId, {...result});
    });

    Whisper.events.on('update-avatar', async id => {
      const conversation = ConversationController.get(id);
      if (!conversation) {
        return;
      }

      await conversation.debouncedUpdateCommonAvatar();
    });

    Whisper.events.on('power-monitor-resume', () => {
      if (isSocketOnline()) {
        messageReceiver.checkStatus();
      }
    });

    Whisper.events.on('manual-logout', onError);

    Whisper.events.on('incoming-call-respond', async ({ event, data }) => {
      if (event === 'reject') {
        const callInfo = incomingCallMap.get(data.roomId);
        const { emk, publicKey } = callInfo;

        const roomCipher = await window.textsecure.CallRoomCipher.from(
          dcodeIO.ByteBuffer.wrap(emk, 'base64').toArrayBuffer(),
          dcodeIO.ByteBuffer.wrap(publicKey, 'base64').toArrayBuffer()
        );

        const { type, roomId, caller } = data;
        const timestamp = Date.now();

        let callees;
        const myUid = textsecure.storage.user.getNumber();
        const theUid = caller;

        callees = [myUid];

        if (type === '1on1') {
          callees.push(theUid);
        }

        const source = window.textsecure.storage.user.getNumber();
        const sourceDevice = window.textsecure.storage.user.getDeviceId();

        /*
          options:
            roomId: string;
            callees: string[];
            collapseId: string;
            ourNumber: string;
            needSync?: boolean;
            type: '1on1' | 'group' | 'instant';
        */
        const options = {
          callees,
          roomId,
          collapseId: makeMessageCollapseId({
            timestamp,
            source,
            sourceDevice,
          }),
          ourNumber: source,
          needSync: true,
          type,
        };

        await window.callAPI.rejectCall(options, roomCipher);

        if (data.type !== '1on1') {
          Whisper.events.trigger('callAdd', {
            ...data,
            conversation: data.groupId,
            caller: {
              uid: data.caller,
            },
          });
        }
      }
    });
  }

  async function createGroupV2(groupInfo) {
    const { name, members } = groupInfo;

    // create groupv2
    // 1 call server create group API, get group id
    // 2 if there are members, call server addmembers API
    // 3 create conversation of groupv2
    // 4 groupv2 created.
    // 5 messages in groupv2 should be handled seperately.

    // because group id returned from server,
    // conversation must created after createGroupV2 API was called.

    let groupId;

    try {
      // call GroupV2API
      // expiration -1: globalConfig
      const result = await textsecure.messaging.createGroupV2(
        name,
        null,
        -1,
        members
      );
      groupId = result.data.gid;
    } catch (error) {
      log.info('createGroupV2: ', error);
      const defaultKey = 'group_editor_create_failed';
      let i18nKey = defaultKey;
      let i18nOption;
      const { response, name, code } = error;
      if (name === 'HTTPError' && code === 400) {
        const { API_STATUS } = APIStatus;
        const { status, data } = response;
        switch (status) {
          case API_STATUS.InvalidParameter:
            i18nKey = 'invalidArgument';
            break;
          case API_STATUS.GroupMemberCountExceeded:
            // group is full or member count exceeded
            i18nKey = 'groupMemberCountExceeded';
            break;
          case API_STATUS.GroupMemberNotYouFriend:
            const { strangers } = data || {};
            const names = strangers
              ?.map(i => i?.name || i?.uid)
              ?.filter(name => name)
              ?.join(',');
            i18nOption = names + ' ';
            i18nKey = 'groupMemberNotYouFriend';
            break;
        }
      }

      return {
        result: false,
        errorMessage: i18n(i18nKey, [i18nOption]) || i18n(defaultKey),
      };
    }

    const ourNumber = textsecure.storage.user.getNumber();

    // should add our number into members list
    members.push(ourNumber);

    // de-duplication
    let membersArray = Array.from(new Set(members));

    // initial V2 members
    const membersV2 = membersArray.map(m => {
      if (m === ourNumber) {
        // role owner
        return { id: m, role: 0 };
      } else {
        // role member
        return { id: m, role: 2 };
      }
    });

    // create & update conversation
    let conversation = await ConversationController.getOrCreateAndWait(
      groupId,
      'group'
    );

    const updates = {
      name: name,
      members: membersArray,
      membersV2: membersV2,
      type: 'group',
      left: false,
      // active_at: Date.now(),
      group_version: 2,
    };
    conversation.set(updates);
    await window.Signal.Data.updateConversation(conversation.attributes);

    // call conversation createGroup to update UI notification
    const groupUpdate = {
      name: name,
      members: membersArray,
    };
    await conversation.createGroup(groupUpdate);
    await conversation.debouncedUpdateLastMessage();

    return { result: true, groupId };
  }

  async function addMembersV2(groupInfo) {
    const { id, members, operator } = groupInfo;
    let conversation = await ConversationController.getOrCreateAndWait(
      id,
      'group'
    );

    try {
      // call GroupV2API and update membersV2 in conversation
      await conversation.apiAddGroupV2Members(members);
    } catch (error) {
      log.error('call addGroupV2Members failed, ', error);

      const defaultKey = 'group_editor_add_members_failed';
      let i18nKey = defaultKey;
      const { response, name, code } = error;
      if (name === 'HTTPError' && code === 400) {
        const { API_STATUS } = APIStatus;
        const { status } = response;
        switch (status) {
          case API_STATUS.InvalidParameter:
            i18nKey = 'invalidArgument';
            break;
          case API_STATUS.NoSuchGroup:
            i18nKey = 'noSuchGroup';
            break;
          case API_STATUS.GroupMemberCountExceeded:
            // group is full or member count exceeded
            i18nKey = 'groupMemberCountExceeded';
            break;
        }
      }

      return {
        result: false,
        errorMessage: i18n(i18nKey) || i18n(defaultKey),
      };
    }

    const oldMembers = conversation.get('members') || [];
    const latestMembers = oldMembers.concat(members);
    // update groups
    const updates = {
      members: latestMembers,
      type: 'group',
      left: false,
      // active_at: activeAt,
      isArchived: false,
      group_version: 2,
    };

    conversation.set(updates);
    await window.Signal.Data.updateConversation(conversation.attributes);

    // send signal add members message
    const groupUpdate = {
      joined: members,
      joinOperator: operator,
    };
    await conversation.updateGroup(groupUpdate);

    // should notify UI success
    return { result: true };
  }

  async function removeMembersV2(groupInfo) {
    const { id, members } = groupInfo;

    const conversation = await ConversationController.getOrCreateAndWait(
      id,
      'group'
    );

    try {
      // call GroupV2API and update membersV2 in conversation
      await conversation.apiRemoveGroupV2Members(members);
    } catch (error) {
      log.error('call apiRemoveGroupV2Members failed, ', error);
      let errorMessage;
      return { result: false, errorMessage };
    }

    const oldMembers = conversation.get('members');
    const updates = {
      members: oldMembers.filter(m => !members.includes(m)),
      type: 'group',
      left: false,
      // active_at: activeAt,
      isArchived: false,
    };
    conversation.set(updates);
    await window.Signal.Data.updateConversation(conversation.attributes);

    // send signal remove members message
    const groupUpdate = {
      removed: members,
    };
    await conversation.updateGroup(groupUpdate, updates.members, oldMembers);

    return { result: true };
  }

  async function moveAdmins(groupInfo, add) {
    const { id, members } = groupInfo;

    const conversation = await ConversationController.getOrCreateAndWait(
      id,
      'group'
    );

    try {
      // call GroupV2API and update membersV2 in conversation
      await conversation.apiMoveAdmins(members, add);
    } catch (error) {
      log.error('call apiMoveAdmins failed, ', error);
      let errorMessage;
      return { result: false, errorMessage };
    }

    const updates = {
      type: 'group',
      left: false,
      // active_at: Date.now(),
      isArchived: false,
    };
    conversation.set(updates);
    await window.Signal.Data.updateConversation(conversation.attributes);

    // send signal remove members message
    const groupUpdate = {
      removeAdmins: add ? undefined : members,
      addAdmins: add ? members : undefined,
    };
    await conversation.updateGroup(groupUpdate);

    return { result: true };
  }

  let disconnectTimer = null;

  function onOffline() {
    window.log.info('offline');

    offlineMessageLoaded = false;

    window.removeEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    // We've received logs from Linux where we get an 'offline' event, then 30ms later
    //   we get an online event. This waits a bit after getting an 'offline' event
    //   before disconnecting the socket manually.
    disconnectTimer = setTimeout(disconnect, 1000);
  }

  function onOnline() {
    window.log.info('online');

    window.removeEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    if (disconnectTimer && isSocketOnline()) {
      window.log.warn('Already online. Had a blip in online/offline status.');
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
      return;
    }
    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }

    connect();
  }

  function isSocketOnline() {
    const socketStatus = window.getSocketStatus();
    return (
      socketStatus === WebSocket.CONNECTING || socketStatus === WebSocket.OPEN
    );
  }

  function disconnect() {
    window.log.info('disconnect');

    // Clear timer, since we're only called when the timer is expired
    disconnectTimer = null;

    if (messageReceiver) {
      messageReceiver.close();
    }
    window.Signal.AttachmentDownloads.stop();
  }

  async function initCallList() {
    // fetch livekit call status
    try {
      const res = await window.callAPI.listCalls();
      if (res.calls && res.calls.length) {
        console.log('[add join button] init call list', Date.now());
        res.calls.forEach(call => {
          if (call.type === 'group') {
            const conversation = ConversationController.get(call.conversation);
            if (!conversation || conversation.isMeLeftGroup()) {
              call.type = 'instant';
              call.conversation = null;
            }
          }
          Whisper.events.trigger('callAdd', call);
        });
      }
    } catch (e) {
      console.log('fetch call status error', e);
    }
  }

  function updateCallList() {
    Whisper.events.trigger('callReset');
    initCallList();
  }

  async function connect(firstRun) {
    window.log.info('connect');

    offlineMessageLoaded = false;

    // Bootstrap our online/offline detection, only the first time we connect
    if (connectCount === 0 && navigator.onLine) {
      window.addEventListener('offline', onOffline);
    }
    if (connectCount === 0 && !navigator.onLine) {
      window.log.warn(
        'Starting up offline; will connect when we have network access'
      );
      window.addEventListener('online', onOnline);
      onEmpty(); // this ensures that the loading screen is dismissed
      return;
    }

    if (!Whisper.Registration.everDone()) {
      return;
    }

    if (messageReceiver) {
      window.log.info('starting for existing messageRecveiver clear.');

      const oldMessageReceiver = messageReceiver;
      messageReceiver = null;

      await oldMessageReceiver.stopProcessing();

      // only should wait for batchers in message receiver when connecting
      await oldMessageReceiver.waitForBatchers();
      oldMessageReceiver.unregisterBatchers();

      window.log.info('clear for existing messageRecveiver done.');
    }

    if (messageReceiver) {
      window.log.info('already connected in another connect, just return');
      return;
    }

    const USERNAME = storage.get('number_id');
    const PASSWORD = storage.get('password');
    const mySignalingKey = storage.get('signaling_key');

    connectCount += 1;
    const options = {
      firstRun,
    };

    Whisper.Notifications.disable(); // avoid notification flood until empty

    // initialize the socket and start listening for messages
    messageReceiver = new textsecure.MessageReceiver(
      USERNAME,
      PASSWORD,
      mySignalingKey,
      options
    );
    messageReceiver.addEventListener('message', onMessageReceived);
    messageReceiver.addEventListener('sent', onSentMessage);
    messageReceiver.addEventListener('readSync', onReadSync);
    messageReceiver.addEventListener('read', onReadReceipt);
    messageReceiver.addEventListener('error', onError);
    messageReceiver.addEventListener('empty', onEmpty);
    messageReceiver.addEventListener('reconnect', onReconnect);
    messageReceiver.addEventListener('progress', onProgress);
    // messageReceiver.addEventListener('typing', onTyping);
    messageReceiver.addEventListener('notification', onChangeNotification);
    messageReceiver.addEventListener('externalMessage', onExternalMessage);
    messageReceiver.addEventListener('markAsUnread', onMarkAsUnread);
    messageReceiver.addEventListener('conversationInfo', onConversationInfo);
    messageReceiver.addEventListener('onArchive', onArchive);
    messageReceiver.addEventListener('latestReads', onLatestReads);
    messageReceiver.addEventListener('callMessage', onCallMessage);

    window.Signal.AttachmentDownloads.start({
      getMessageReceiver: () => messageReceiver,
      logger: window.log,
    });

    window.textsecure.messaging = new textsecure.MessageSender(
      USERNAME,
      PASSWORD
    );

    window.callAPI = new textsecure.CallSender(USERNAME, PASSWORD);

    const deviceId = textsecure.storage.user.getDeviceId();
    window.log.info('current deviceId:', deviceId);

    if (connectCount === 1) {
      // On startup after upgrading to a new version, or running first time

      window.preloadCallWindow();

      // set read-receipt-setting true
      const isPrimaryDevice = deviceId == 1;
      if (isPrimaryDevice && (firstRun || newVersion)) {
        // if our device is primary, set read-receipt-setting true
        storage.put('read-receipt-setting', true);
        log.info('put read receipt setting');
      }

      window.getAccountManager().setProfile({
        meetingVersion,
        msgEncVersion: window.MESSAGE_CURRENT_VERSION,
      });

      let directoryVersion;
      let contacts;
      try {
        const result = await textsecure.messaging.fetchDirectoryContacts();
        contacts = result['contacts'];
        directoryVersion = result['directoryVersion'];
      } catch (error) {
        window.log.error('load directory contacts failed.', error);
      }

      if (directoryVersion) {
        storage.put('directoryVersion', directoryVersion);
      }

      let groupContacts;
      try {
        const result = await textsecure.messaging.getGroupV2List();
        groupContacts = result.data.groups || [];
      } catch (error) {
        window.log.error('load group contacts failed.', error);
      }

      // if contacts/groupContacts is undefined, do not update it
      await ConversationController.bulkCreateContactConversations(
        contacts,
        groupContacts
      );

      try {
        const result = await textsecure.messaging.getConversationConfig();

        const { conversations: configArray } = result?.data || {};
        if (configArray?.length) {
          await ConversationController.updateConversationConfigs(configArray);
        }
      } catch (error) {
        window.log.error('load conversations failed.', error);
      }

      try {
        const result = await window.getAccountManager().getKeysV3ForUids();

        ConversationController.bulkUpdateIdentityKeyResetInfo(
          result.keys || []
        );
      } catch (error) {
        window.log.error('bulk update identity key reset info failed.', error);
      }
    }

    updateCallList();

    storage.onready(async () => {
      idleDetector.start();
    });
  }

  function onChangeTheme() {
    const view = window.owsDesktopApp.appView;
    if (view) {
      view.applyTheme();
    }
  }

  function onEmpty(ev) {
    const { incomingQueueEmpty } = ev || {};

    if (incomingQueueEmpty) {
      initialLoadComplete = true;
      offlineMessageLoaded = true;
    }

    window.readyForUpdates();

    let interval = setInterval(() => {
      const view = window.owsDesktopApp.appView;
      if (view) {
        clearInterval(interval);
        interval = null;
        view.onEmpty();
      }
    }, 500);

    Whisper.Notifications.enable();
  }

  function onReconnect() {
    // We disable notifications on first connect, but the same applies to reconnect. In
    //   scenarios where we're coming back from sleep, we can get offline/online events
    //   very fast, and it looks like a network blip. But we need to suppress
    //   notifications in these scenarios too. So we listen for 'reconnect' events.
    Whisper.Notifications.disable();
  }

  function onProgress(ev) {
    const { count } = ev;
    window.log.info(`onProgress: Message count is ${count}`);

    const view = window.owsDesktopApp.appView;
    if (view) {
      view.onProgress(count);
    }
  }

  // function onTyping(ev) {
  //   const { typing, sender, senderDevice } = ev;
  //   const { groupId, started } = typing || {};

  //   // We don't do anything with incoming typing messages if the setting is disabled
  //   if (!storage.get('typingIndicators')) {
  //     return;
  //   }

  //   const conversation = ConversationController.get(groupId || sender);

  //   if (conversation) {
  //     conversation.notifyTyping({
  //       isTyping: started,
  //       sender,
  //       senderDevice,
  //     });
  //   }
  // }

  // Descriptors
  const getGroupDescriptor = group => ({
    type: Message.GROUP,
    id: group.id,
  });

  // Matches event data from `libtextsecure` `MessageReceiver::handleSentMessage`:
  const getDescriptorForSent = ({ message, destination }) =>
    message.group
      ? getGroupDescriptor(message.group)
      : { type: Message.PRIVATE, id: destination };

  // Matches event data from `libtextsecure` `MessageReceiver::handleDataMessage`:
  const getDescriptorForReceived = ({ message, source }) =>
    message.group
      ? getGroupDescriptor(message.group)
      : { type: Message.PRIVATE, id: source };

  function createMessageHandler({
    createMessage,
    getMessageDescriptor,
    handleProfileUpdate,
  }) {
    return async event => {
      const { data, confirm } = event;
      const messageDescriptor = getMessageDescriptor(data);

      const { PROFILE_KEY_UPDATE } = textsecure.protobuf.DataMessage.Flags;
      // eslint-disable-next-line no-bitwise
      const isProfileUpdate = Boolean(data.message.flags & PROFILE_KEY_UPDATE);
      if (isProfileUpdate) {
        return handleProfileUpdate({ data, confirm, messageDescriptor });
      }

      const conversation = await ConversationController.getOrCreateAndWait(
        messageDescriptor.id,
        messageDescriptor.type
      );

      let message = await createMessage(data, conversation.id);

      if (data.message?.reaction) {
        // we use this message, but we DO NOT save it laterly.
        const { source = {} } = data.message.reaction;

        if (data.message.group) {
          message.set({ conversationId: messageDescriptor.id });
        }

        const reactionMessage = Whisper.EmojiReactions.add({
          initialMessage: data.message,
          whisperMessage: message,
          ...source,
        });

        // set as read here when received some one's reaction
        setTimeout(() => {
          if (!conversation.isChatWithoutReceipt()) {
            Whisper.ReadReceipts.forMessage(message);
          }
        }, 0);

        return Whisper.EmojiReactions.onEmojiReaction(reactionMessage, confirm);
      }

      const filterDuplicate = async () => {
        const duplicate = await getMessageDuplicate(conversation, message);
        if (duplicate) {
          if (duplicate.isUnsupportedMessage()) {
            // rehandle duplicated unsupported message when app has been updated
            log.info(
              `rehandle unsupported message ${duplicate.idForLogging()}`
            );

            const registered = MessageController.register(
              duplicate.id,
              duplicate
            );

            // reaction unsupported messages should be deleted
            if (registered.isReactionUnsupportedMessage()) {
              return null;
            }

            return registered;
          } else {
            window.log.warn(
              'Received duplicate message',
              duplicate.idForLogging(),
              duplicate.get('received_at')
            );
          }
        } else {
          return message;
        }
      };

      message = await filterDuplicate();
      if (!message) {
        // has duplicated
        return event.confirm();
      }

      // break task
      await new Promise(r => setTimeout(r, 0));

      if (data.createCallMessageOptions) {
        data.message.body = window.getCallTextMessage(
          data.createCallMessageOptions.action,
          data.createCallMessageOptions.type,
          data.createCallMessageOptions.source
        );
      }

      return message.handleDataMessage(
        data.message,
        event.confirm,
        filterDuplicate,
        data.conversationPushedAt
      );
    };
  }

  // Received:
  async function handleMessageReceivedProfileUpdate({
    data,
    confirm,
    messageDescriptor,
  }) {
    const profileKey = data.message.profileKey.toString('base64');
    const sender = await ConversationController.getOrCreateAndWait(
      messageDescriptor.id,
      'private'
    );

    // Will do the save for us
    await sender.setProfileKey(profileKey);

    return confirm();
  }

  const onMessageReceived = createMessageHandler({
    handleProfileUpdate: handleMessageReceivedProfileUpdate,
    getMessageDescriptor: getDescriptorForReceived,
    createMessage: initIncomingMessage,
  });

  // Sent:
  async function handleMessageSentProfileUpdate({
    data,
    confirm,
    messageDescriptor,
  }) {
    // First set profileSharing = true for the conversation we sent to
    const { id, type } = messageDescriptor;
    const conversation = await ConversationController.getOrCreateAndWait(
      id,
      type
    );

    conversation.set({ profileSharing: true });
    await window.Signal.Data.updateConversation(conversation.attributes);

    // Then we update our own profileKey if it's different from what we have
    const ourNumber = textsecure.storage.user.getNumber();
    const profileKey = data.message.profileKey.toString('base64');
    const me = ConversationController.getOrCreate(ourNumber, 'private');

    // Will do the save for us if needed
    await me.setProfileKey(profileKey);

    return confirm();
  }

  function adaptTimestamp(data) {
    if (data.timestamp) {
      return data.timestamp;
    }
    if (data.createCallMessageOptions) {
      return textsecure.CallHelper.generateCallMessageTimestamp(
        data.createCallMessageOptions
      );
    }
  }

  function createSentMessage(data, conversationId) {
    const now = Date.now();
    data.timestamp = adaptTimestamp(data);

    return new Whisper.Message({
      source: textsecure.storage.user.getNumber(),
      sourceDevice: data.device,
      sent_at: data.timestamp,
      received_at: now,
      conversationId,
      type: 'outgoing',
      sent: true,
      expirationStartTimestamp: Math.min(
        data.expirationStartTimestamp || data.timestamp || Date.now(),
        Date.now()
      ),
      rapidFiles: data.rapidFiles,
      serverTimestamp: data.serverTimestamp || data.timestamp,
      sequenceId: data.sequenceId,
      notifySequenceId: data.notifySequenceId,
    });
  }

  const onSentMessage = createMessageHandler({
    handleProfileUpdate: handleMessageSentProfileUpdate,
    getMessageDescriptor: getDescriptorForSent,
    createMessage: createSentMessage,
  });

  async function getMessageDuplicate(conversation, message) {
    if (conversation) {
      const collection = conversation.messageCollection;

      const sent_at = message.get('sent_at');
      const source = message.getSource();
      const sourceDevice = message.getSourceDevice();

      let founds = collection.where({ sent_at });
      if (founds?.length) {
        const isMatch = model =>
          model.getSource() === source &&
          model.getSourceDevice() == sourceDevice;

        const found = founds.find(isMatch);
        if (found) {
          return found;
        }
      }

      try {
        const condition = {
          sent_at,
          source,
          sourceDevice,
          fromCurrentDevice: message.maybeFromCurrentDevice(),
        };

        return await window.Signal.Data.getMessageBySender(condition, {
          Message: Whisper.Message,
        });
      } catch (error) {
        window.log.error(
          'getMessageDuplicate error:',
          Errors.toLogFormat(error)
        );
        return false;
      }
    }
  }

  async function initIncomingMessage(data, conversationId) {
    data.timestamp = adaptTimestamp(data);

    const message = new Whisper.Message({
      source: data.source,
      sourceDevice: data.sourceDevice,
      sent_at: data.timestamp,
      received_at: data.receivedAt || Date.now(),
      conversationId,
      type: 'incoming',
      unread: 1,
      envelopeType: data.envelopeType,
      serverTimestamp: data.serverTimestamp || data.timestamp,
      sequenceId: data.sequenceId,
      notifySequenceId: data.notifySequenceId,
    });

    return message;
  }

  const onExternalMessage = async event => {
    const { data, confirm } = event;
    log.warn('Unsupported external message', data.external);
    return confirm?.();
  };

  const onArchive = async ev => {
    const { conversationArchive } = ev;

    if (!conversationArchive) {
      return;
    }

    const { conversationId, flag, timestamp } = conversationArchive;
    const conversation = ConversationController.get(conversationId);
    if (!conversation) {
      return;
    }
    const onArchiveAt = conversation.get('onArchiveAt');
    if (!onArchiveAt || onArchiveAt < timestamp) {
      conversation.set({ onArchiveAt: timestamp });
      if (
        flag ===
        textsecure.protobuf.SyncMessage.ConversationArchive.Flag.ARCHIVE
      ) {
        await conversation.setArchived(true);
        await conversation.markAsRead();
      }
    }
  };

  const onMarkAsUnread = async ev => {
    const { markAsUnread } = ev;

    if (!markAsUnread) {
      return;
    }

    const { conversationId, flag, timestamp } = markAsUnread;
    const conversation = ConversationController.get(conversationId);
    if (!conversation) {
      return;
    }

    const markAsAt = conversation.get('markAsAt');
    if (!markAsAt || markAsAt < timestamp) {
      conversation.set({ markAsAt: timestamp });

      const lastReadPosition = await conversation.getLastReadPosition();
      if (lastReadPosition?.maxServerTimestamp > timestamp) {
        conversation.unset('markAsFlag');
        return;
      }

      conversation.set({ markAsFlag: flag });

      if (flag === textsecure.protobuf.SyncMessage.MarkAsUnread.Flag.READ) {
        await conversation.markAsRead();
      }
    }
  };

  const onConversationInfo = async ev => {
    const { conversationInfo = {} } = ev;

    log.info('on received conversation info', conversationInfo);

    const { conversationPreview } = conversationInfo;
    if (!conversationPreview) {
      log.error('invalid conversation preview.');
      return;
    }

    const { conversationId = {} } = conversationPreview;
    const { number, groupId } = conversationId;

    if (!number && !groupId) {
      log.error('Invalid conversationId for conversationPreview');
      return;
    }

    const id = number || groupId;
    if (id === 'server') {
      log.warn('skip server notifications.');
      return;
    }

    const type = number ? 'private' : 'group';
    const conversation = await ConversationController.getOrCreateAndWait(
      id,
      type
    );
    if (!conversation) {
      log.error('Can not find conversation for id', id);
      return;
    }

    // handle preview latest self read position
    const { readPosition } = conversationPreview;
    if (readPosition?.maxServerTimestamp && readPosition?.readAt) {
      // position from server does not contain sourceDevice
      conversation.onReadPosition({
        sourceDevice: 999,
        ...readPosition,
        conversationId: id,
      });
    } else {
      log.warn('skip invalid read position', readPosition);
    }
  };

  const onLatestReads = async ev => {
    const { conversationId, readPositions } = ev;

    const { number, groupId } = conversationId;

    if (!number && !groupId) {
      log.error('Invalid conversationId for conversationPreview');
      return;
    }

    const id = number || groupId;
    if (id === 'server') {
      log.warn('skip server notifications.');
      return;
    }

    const type = number ? 'private' : 'group';
    const conversation = await ConversationController.getOrCreateAndWait(
      id,
      type
    );

    if (!conversation) {
      log.error('Can not find conversation for id', id);
      return;
    }

    const readByAtMapping = conversation.get('read_by_at') || {};
    const newReadByAtMapping = {};

    let changed = false;
    for (const position of readPositions) {
      const { source, maxServerTimestamp, maxNotifySequenceId } = position;
      const oldPosition = readByAtMapping[source];
      if (!oldPosition || maxServerTimestamp > oldPosition.maxServerTimestamp) {
        changed = true;
        newReadByAtMapping[source] = {
          reader: source,
          conversationId: conversation.id,
          readAt: position.readAt,
          maxServerTimestamp,
          maxNotifySequenceId,
        };
      }
    }

    if (changed) {
      conversation.set({
        read_by_at: { ...readByAtMapping, ...newReadByAtMapping },
      });
      await window.Signal.Data.updateConversation(conversation.attributes);
    }
  };

  async function onCallMessage(ev) {
    const { callMessage, confirm, source } = ev;
    const { calling, reject, joined, cancel, hangup } = callMessage;

    const deviceId = textsecure.storage.user.getDeviceId();
    const ourNumber = textsecure.storage.user.getNumber();

    if (calling) {
      let { conversationId, roomId, caller } = calling;
      if (source !== caller) {
        window.log.error(
          `source error: calling source ${source} is not equal to caller ${caller}`
        );
        return confirm?.();
      }

      let isPrivate;
      let type;
      if (conversationId) {
        isPrivate = !!conversationId.number;
        type = isPrivate ? '1on1' : 'group';
      } else {
        isPrivate = true;
        type = 'instant';
      }

      if (!isPrivate) {
        const group = ConversationController.get(conversationId.groupId);
        // treat as instant
        if (!group || group.isMeLeftGroup()) {
          isPrivate = true;
          type = 'instant';
          conversationId = null;
        }
      }

      const username = textsecure.storage.get('number_id');

      let roomName;
      if (type === 'instant') {
        const caller = ConversationController.get(calling.caller);
        roomName = caller
          ? `${caller.getName()}'s instant call`
          : 'instant call';
      } else if (calling.roomName) {
        roomName = calling.roomName;
      } else {
        if (conversationId) {
          const conversation = ConversationController.get(
            conversationId.number || conversationId.groupId
          );
          roomName = conversation?.getName();
        } else {
          roomName = calling.roomName;
        }
      }

      console.log('incoming calling object', calling);

      let callInfo;

      try {
        callInfo = await window.callAPI.checkCall(roomId);
        console.log('check call info', callInfo);
      } catch (e) {
        console.log('check call info error, already destroyed');
        return confirm?.();
      }

      const fromMe = source === ourNumber;

      const getTargetConversation = () => {
        switch (type) {
          case '1on1':
            return fromMe ? conversationId.number : source;
          case 'group':
            return conversationId?.groupId;
          default:
            return null;
        }
      };

      Whisper.events.trigger('callAdd', {
        ...conversationId,
        ...calling,
        isPrivate,
        roomId,
        type,
        conversation: getTargetConversation(),
      });

      if (fromMe || callInfo.anotherDeviceJoined || callInfo.userStopped) {
        return confirm?.();
      }

      const conversation = {
        '1on1': calling.caller,
        group: conversationId?.groupId,
        instant: undefined,
      };

      if (incomingCallMap.has(roomId)) {
        await window.hideIncomingCallWindow(roomId);
      }

      // 被叫
      incomingCallMap.set(roomId, {
        ...conversationId,
        ...calling,
        isPrivate,
        roomId,
        type,
        conversation: conversation[type],
      });

      const ourName = ConversationController.get(ourNumber).getName();

      window.dispatchCallMessage('incomingCall', {
        ...conversationId,
        ...calling,
        isPrivate,
        roomId,
        roomName,
        type,
        username,
        deviceId,
        ourName,
      });
    } else if (reject) {
      const { roomId } = reject;
      await window.onRejectCall(roomId);
      const callInfo = incomingCallMap.get(roomId);

      if (callInfo && callInfo.caller !== ourNumber) {
        Whisper.events.trigger('callAdd', {
          ...callInfo,
          caller: {
            uid: callInfo.caller,
          },
        });
        incomingCallMap.delete(roomId);
      }
    } else if (joined) {
      await window.hideIncomingCallWindow(joined.roomId);
      const callInfo = incomingCallMap.get(joined.roomId);

      // fix: desktop 先入会，mobile 后入会，join button 会在 1on1 会话上短暂出现
      if (callInfo && callInfo.roomId !== window.currentCallRoomId) {
        Whisper.events.trigger('callAdd', {
          ...callInfo,
          caller: {
            uid: callInfo.caller,
          },
        });
        incomingCallMap.delete(joined.roomId);
      }
    } else if (cancel) {
      window.destroyCall(cancel.roomId);
    } else if (hangup) {
      window.destroyCall(hangup.roomId, 'hangup');
      Whisper.events.trigger('callRemove', { roomId: hangup.roomId });
    }
    if (typeof confirm === 'function') {
      confirm();
    }
  }

  let isLoggedOut = false;
  async function onError(ev) {
    const { error, manualLogout } = ev;
    window.log.error('background onError:', Errors.toLogFormat(error));

    // the client version too old
    if (error && error.code === 450) {
      await window.forceUpdateAlert();
      window.sendBrowserOpenUrl('https://yelling.pro');
      window.wantQuit();
      return;
    }

    const { action } = error?.response?.data || {};

    if (manualLogout || action === 'delete') {
      try {
        await textsecure.storage.protocol.removeAllData();
        window.relaunch();
        return;
      } catch (error) {
        window.log.error(
          'Something went wrong deleting data from previous number',
          error && error.stack ? error.stack : error
        );
      }
    }

    if (
      error &&
      error.name === 'HTTPError' &&
      (error.code === 401 || error.code === 403)
    ) {
      if (isLoggedOut) {
        window.log.info('background logging out');
        return;
      }

      isLoggedOut = true;

      const oldTheme = storage.get('theme-setting');
      Whisper.events.trigger('unauthorized');

      if (messageReceiver) {
        await messageReceiver.stopProcessing();
        await window.waitForAllBatchers();
        messageReceiver.unregisterBatchers();
      }

      onEmpty();

      window.log.warn(
        'Client is no longer authorized; deleting local configuration'
      );
      Whisper.Registration.remove();

      const NUMBER_ID_KEY = 'number_id';
      const VERSION_KEY = 'version';
      const LAST_PROCESSED_INDEX_KEY = 'attachmentMigration_lastProcessedIndex';
      const IS_MIGRATION_COMPLETE_KEY = 'attachmentMigration_isComplete';

      const previousNumberId = textsecure.storage.get(NUMBER_ID_KEY);
      const lastProcessedIndex = textsecure.storage.get(
        LAST_PROCESSED_INDEX_KEY
      );
      const isMigrationComplete = textsecure.storage.get(
        IS_MIGRATION_COMPLETE_KEY
      );

      try {
        await textsecure.storage.protocol.removeAllConfiguration();

        // These two bits of data are important to ensure that the app loads up
        //   the conversation list, instead of showing just the QR code screen.
        Whisper.Registration.markEverDone();
        textsecure.storage.put(NUMBER_ID_KEY, previousNumberId);

        // These two are important to ensure we don't rip through every message
        //   in the database attempting to upgrade it after starting up again.
        textsecure.storage.put(
          IS_MIGRATION_COMPLETE_KEY,
          isMigrationComplete || false
        );
        textsecure.storage.put(
          LAST_PROCESSED_INDEX_KEY,
          lastProcessedIndex || null
        );
        textsecure.storage.put(VERSION_KEY, window.getVersion());

        window.log.info('Successfully cleared local configuration');
      } catch (eraseError) {
        window.log.error(
          'Something went wrong clearing local configuration',
          eraseError && eraseError.stack ? eraseError.stack : eraseError
        );
      }

      if (oldTheme) {
        storage.put('theme-setting', oldTheme);
      }

      window.relaunch();
      return;
    }

    if (
      error &&
      error.name === 'HTTPError' &&
      (error.code === -1 ||
        error.code === 429 ||
        (error.code >= 500 && error.code <= 599))
    ) {
      // Failed to connect to server
      if (navigator.onLine) {
        window.log.info('retrying in 15s');
        setTimeout(connect, 15000);

        Whisper.events.trigger('reconnectTimer', 15000);
      }
      return;
    }

    // clear reconnect timer displays
    Whisper.events.trigger('reconnectTimer', null);

    if (ev.proto) {
      if (error && error.name === 'MessageCounterError') {
        if (ev.confirm) {
          ev.confirm();
        }
        // Ignore this message. It is likely a duplicate delivery
        // because the server lost our ack the first time.
        return;
      }
      const envelope = ev.proto;

      // just do not show error message.
      window.log.warn(
        'background onError: Doing nothing with incoming error:',
        _.pick(envelope, ['source', 'sourceDevice', 'timestamp', 'receivedAt'])
      );

      if (ev.confirm) {
        ev.confirm();
      }

      // // there will be a empty message while envelope.source is null.
      // if (envelope.source) {
      //   const message = await initIncomingMessage(envelope, {isError: true});

      //   await message.saveErrors(error || new Error('Error was null'));
      //   const id = message.get('conversationId');
      //   const conversation = await ConversationController.getOrCreateAndWait(
      //     id,
      //     'private'
      //   );
      //   conversation.set({
      //     active_at: Date.now(),
      //     unreadCount: conversation.get('unreadCount') + 1,
      //   });

      //   const conversationTimestamp = conversation.get('timestamp');
      //   const messageTimestamp = message.get('timestamp');
      //   if (!conversationTimestamp || messageTimestamp > conversationTimestamp) {
      //     conversation.set({timestamp: message.get('sent_at')});
      //   }

      //   conversation.trigger('newmessage', message);
      //   conversation.notify(message);

      //   if (ev.confirm) {
      //     ev.confirm();
      //   }

      //   await window.Signal.Data.updateConversation(id, conversation.attributes, {
      //     Conversation: Whisper.Conversation,
      //   });
      // } else {
      //   // we just delete this from cache and return to fix this empty message.
      //   window.log.info('envelope has invalid source, just drop this envelope');
      //   if (ev.confirm) {
      //     ev.confirm();
      //   }
      //   return;
      // }
    }

    throw error;
  }

  function onReadReceipt(ev) {
    const reads = ev.reads || [];
    const readPosition = ev.readPosition;

    window.log.info('read receipt', reads, readPosition, 'at', ev.timestamp);

    // Calling this directly so we can wait for completion
    return Whisper.ReadReceipts.onReceipt(reads, readPosition, ev.confirm);
  }

  function onReadSync(ev) {
    const reads = ev.reads || [];
    window.log.info('read sync', reads, 'at', ev.timestamp);

    // Calling this directly so we can wait for completion
    return Whisper.ReadSyncs.onReceipt(reads, ev.confirm);
  }

  const NOTIFY_TYPE = {
    CHANGE_BASIC: 0,
    CHANGE_MEMBERS: 1,
    CHANGE_MEMBER_INFO: 2,
    CHANGE_ANNOUNCEMENT: 3,
    CHANGE_MY_SETTINGS: 4,
    CHANGE_PIN: 5,
    DEPRECATED_CHANGE_MEETING_USER_JOIN_LEAVE: 7,
    CHANGE_GROUP_REMIND_CYCLE: 8,
    DEPRECATED_CHANGE_GROUP_MEETING_REMIND: 9,
    //  ************* 为了支持 IOS 端的逻辑，服务端推送 CHANGE_MEMBER_INFO 改为推送 CHANGE_MEMBER_INFO_RAPID。等后续版本迭代以后再删除!!!!! ******************
    CHANGE_MEMBER_INFO_RAPID: 100,
    //  ************* 为了支持 IOS 端的逻辑，服务端推送 CHANGE_MEMBER_INFO 改为推送 CHANGE_MEMBER_INFO_RAPID。等后续版本迭代以后再删除!!!!! ******************
  };

  const NOTIFY_DETAILED_TYPE = {
    CREATE_GROUP: 0,
    JOIN_GROUP: 1,
    LEAVE_GROUP: 2,
    INVITE_JOIN_GROUP: 3,
    KICKOUT_GROUP: 4,
    DISMISS_GROUP: 5,
    GROUP_NAME_CHANGE: 6,
    GROUP_AVATAR_CHANGE: 7,
    GROUP_MSG_EXPIRY_CHANGE: 8,
    GROUP_ADD_ADMIN: 9,
    GROUP_DEL_ADMIN: 10,
    GROUP_MEMBERINFO_CHANGE: 11,
    GROUP_CHANGE_OWNER: 12,
    GROUP_ADD_ANNOUNCEMENT: 13,
    GROUP_UPDATE_ANNOUNCEMENT: 14,
    GROUP_DEL_ANNOUNCEMENT: 15,
    GROUP_OTHER_CHANGE: 16,
    GROUP_MEMBERINFO_CHANGE_PRIVATE: 17,
    GROUP_ADD_PIN: 18,
    GROUP_DEL_PIN: 19,
    GROUP_INVITATION_RULE_CHANGE: 20,
    GROUP_REMIND_CHANGE: 21,
    GROUP_REMIND: 22,
    GROUP_CHANGE_RAPID_ROLE: 23,
    GROUP_ANYONE_REMOVE_CHANGE: 24,
    GROUP_REJOIN_CHANGE: 25,
    GROUP_EXT_CHANGE_ACCOUNT: 26,
    GROUP_PUBLISH_ONLY_GROUP_RULE_CHANGE: 27,
    GROUP_DESTROY: 35,
  };

  const CHANGE_ACTION = {
    ADD: 0,
    UPDATE: 1,
    LEAVE: 2,
    DELETE: 3,
    NONE: 4,
  };

  function mergeMembers(conversation, changedMembers, operator) {
    if (!changedMembers?.length) {
      log.info('There is no changed members.');
      return {};
    }
    // notification changed members
    const addedMembers = changedMembers.filter(
      m => m.action === CHANGE_ACTION.ADD
    );
    const leftMembers = changedMembers.filter(
      m => m.action === CHANGE_ACTION.LEAVE
    );
    const removedMembers = changedMembers.filter(
      m => m.action === CHANGE_ACTION.DELETE
    );
    const updatedMembers = changedMembers.filter(
      m => m.action === CHANGE_ACTION.UPDATE
    );

    // changed numbers array
    const addedArray = addedMembers.map(m => m.uid) || [];
    const leftArray = leftMembers.map(m => m.uid) || [];
    const removedArray = removedMembers.map(m => m.uid) || [];
    const changedArray = changedMembers.map(m => m.uid) || [];

    // 从 conversation 中获取，'members' 以 'membersV2' 中数据为准
    const existMembersV2 = conversation.get('membersV2') || [];
    const existMembers = existMembersV2.map(m => m.id) || [];

    // {
    //   "uid":"+72212204429",
    //   "role":0,
    //   "displayName":"",
    //   "notification":1,
    //   "action":0
    // }
    const addedMembersV2 =
      addedMembers.map(m => {
        return {
          id: m.uid,
          role: m.role,

          displayName: m.displayName,
        };
      }) || [];

    const updatedMembersV2 = updatedMembers.map(m => ({
      id: m.uid,
      role: m.role,
      displayName: m.displayName,
    }));

    // added members may already exists, members should respect data from server
    let changedMembersV2 =
      existMembersV2.filter(m => !changedArray.includes(m.id)) || [];
    changedMembersV2 = changedMembersV2.concat(addedMembersV2);
    changedMembersV2 = changedMembersV2.concat(updatedMembersV2);

    const changedMembersV1 = changedMembersV2.map(m => m.id);

    let update = {
      members: changedMembersV1,
      membersV2: changedMembersV2,
    };

    const ourNumber = textsecure.storage.user.getNumber();

    // 这里逻辑有点绕，因为单从服务端推过来的数据，无法简单判断是否群主发生变化，或管理员新增移除，
    // 必须与客户端本地旧数据比较才可以知道，
    // 群主变化
    let hasOwner;
    for (let i = 0; i < changedMembers.length; i += 1) {
      if (changedMembers[i].role === 0) {
        hasOwner = changedMembers[i].uid;
        break;
      }
    }
    if (hasOwner) {
      for (let i = 0; i < existMembersV2.length; i += 1) {
        if (existMembersV2[i].id !== hasOwner && existMembersV2[i].role === 0) {
          conversation.set(update);
          const groupUpdate = {
            changeOwner: hasOwner,
          };
          return groupUpdate;
        }
      }
    }

    // 管理员变化, 只有一个member变化
    let hasAdmin;
    let hasUser;
    if (changedMembers.length === 1) {
      for (let i = 0; i < changedMembers.length; i += 1) {
        if (changedMembers[i].role === 1) {
          hasAdmin = changedMembers[i].uid;
        }
        if (changedMembers[i].role === 2) {
          hasUser = changedMembers[i].uid;
        }
      }
      if (hasAdmin) {
        for (let i = 0; i < existMembersV2.length; i += 1) {
          if (
            existMembersV2[i].id === hasAdmin &&
            existMembersV2[i].role === 2
          ) {
            conversation.set(update);
            const groupUpdate = {
              addAdmins: [hasAdmin],
            };
            return groupUpdate;
          }
        }
      }
      if (hasUser) {
        for (let i = 0; i < existMembersV2.length; i += 1) {
          if (
            existMembersV2[i].id === hasUser &&
            existMembersV2[i].role === 1
          ) {
            conversation.set(update);
            const groupUpdate = {
              removeAdmins: [hasUser],
            };
            return groupUpdate;
          }
        }
      }
    }

    // add / leave / remove should not come together.
    let groupUpdate = {};
    const realAddedArray = addedArray.filter(m => !existMembers.includes(m));
    if (realAddedArray.length > 0) {
      groupUpdate.joined = realAddedArray;
      groupUpdate.joinOperator = operator;
    }

    // leftArray length is 0 or 1
    if (leftArray.length > 0) {
      if (leftArray[0] === ourNumber) {
        groupUpdate.left = 'You';
      } else {
        groupUpdate.left = leftArray[0];
      }
      if (leftArray.includes(ourNumber)) {
        update.left = true;
      }
    }

    if (removedArray.length > 0) {
      groupUpdate.removed = removedArray;
      if (removedArray.includes(ourNumber)) {
        update.left = true;

        let me;
        for (let i = 0; i < removedMembers.length; i++) {
          if (removedMembers[i].uid === ourNumber) {
            me = removedMembers[i];
            break;
          }
        }
        const { inviteCode } = me || {};
        if (inviteCode) {
          // 这一时刻， 是否可以 rejoin
          const rejoin = conversation.get('rejoin');

          // 1-only admin //2-everyone
          const invitationRule = conversation.get('invitationRule');

          // 0-owner,1-admin,2-member
          let operatorRole;
          const membersV2 = conversation.get('membersV2');
          for (let i = 0; i < membersV2.length; i++) {
            if (membersV2[i].id === operator) {
              operatorRole = membersV2[i].role;
              break;
            }
          }
          log.info(
            'current rejoin role: ' + rejoin,
            'operatorRole:' + operatorRole,
            'invitationRule: ' + invitationRule
          );

          if (rejoin) {
            if (invitationRule === 1) {
              if (operatorRole === 0 || operatorRole === 1) {
                groupUpdate.inviteCode = inviteCode;
              }
            } else {
              groupUpdate.inviteCode = inviteCode;
            }
          }
        }
      }
    }

    conversation.set(update);
    return groupUpdate;
  }

  function onChangeNotification(ev) {
    const { notification } = ev;
    ev.confirm();
    log.info('notification for coversation:', notification);
    const { notifyType, notifyTime, display, data } = notification;
    switch (notifyType) {
      case 0:
        return queueGroupChangeHandler(notifyTime, data, display);
      case 1:
        return queueDirectoryChangeHandler(notifyTime, data);
      case 2:
      case 3:
        log.warn('Unsupported notify type', notifyType);
        return;
      case 4:
        return queueConversationChangeHandler(notifyTime, data, display);
      case 5:
        return queueConversationShareChangeHandler(notifyTime, data, display);
      case 6:
        return queueFriendshipChangeHandler(notifyTime, data);
      case 8:
        return queueReminderChangeHandler(notifyTime, data);
      case 17:
        return queueCallDestroyHandler(notifyTime, data);
      case 19:
        return queueIdentityKeyResetHandler(notifyTime, data);
      default:
        log.warn('unknown notify type,', notifyType);
        return;
    }
  }

  function queueReminderChangeHandler(notifyTime, data) {
    // type: group | private
    // conversation: uid | gid
    const { type, conversation: cid } = data || {};
    if (type !== 'private' && type !== 'group') {
      log.info('Reminder notify unknown type:', type);
      return;
    }

    const id = type === 'group' ? window.Signal.ID.convertIdToV1(cid) : cid;
    return ConversationController.getOrCreateAndWait(id, type).then(
      conversation => {
        conversation.queueJob(() =>
          handleReminderChange(
            notifyTime,
            {
              ...data,
              idV1: cid,
              idV2: id,
            },
            conversation
          )
        );
      }
    );
  }

  function queueCallDestroyHandler(notifyTime, data) {
    setTimeout(() => {
      // should close call window, if exist
      window.destroyCall(data.roomId, 'hangup');
      Whisper.events.trigger('callRemove', { roomId: data.roomId });
    }, 1500);
  }

  function queueIdentityKeyResetHandler(notifyTime, data) {
    const { operator, resetIdentityKeyTime: identityKeyResetAt } = data;
    const conversation = ConversationController.get(operator);

    if (conversation?.getIdentityKeyResetAt() < identityKeyResetAt) {
      conversation.set({ identityKeyResetAt });
      window.Signal.Data.updateConversation(conversation.attributes);

      conversation.saveNewLocalMessage({
        identityKeyReset: { timestamp: identityKeyResetAt, operator },
        serverTimestamp: identityKeyResetAt,
        sent_at: identityKeyResetAt,
      });
    }
  }

  function queueGroupChangeHandler(notifyTime, data, display) {
    const { gid, ver, groupNotifyType, groupVersion } = data;
    if (ver !== 1) {
      log.error(
        '[',
        ver,
        notifyTime,
        '] group notification version must be 1.'
      );
      return;
    }

    const isGroupCycleNotify =
      groupNotifyType === NOTIFY_TYPE.CHANGE_GROUP_REMIND_CYCLE;
    const idV2 = gid;
    if (
      !idV2 ||
      typeof groupNotifyType != 'number' ||
      (typeof groupVersion != 'number' && !isGroupCycleNotify)
    ) {
      log.error('[', idV2, notifyTime, '] invalid notification.');
      return;
    }

    const idV1 = window.Signal.ID.convertIdToV1(idV2);
    return ConversationController.getOrCreateAndWait(idV1, 'group').then(
      conversation => {
        conversation.queueJob(() =>
          handleGroupChangeNotification(
            idV1,
            idV2,
            groupNotifyType,
            conversation,
            notifyTime,
            groupVersion,
            data,
            display
          )
        );
      }
    );
  }

  const directoryChangeQueue = new window.PQueue({ concurrency: 1 });
  function queueDirectoryChangeHandler(notifyTime, data) {
    // just add handler to queue
    directoryChangeQueue.add(() => handleDirectoryChange(notifyTime, data));
  }

  async function queueFriendshipChangeHandler(notifyTime, data) {
    const { operatorId } = data?.operatorInfo || {};
    if (!operatorId) {
      log.error('invalid operator id', operatorId);
      return;
    }

    let conversation;
    try {
      conversation = await ConversationController.getOrCreateAndWait(
        operatorId,
        'private'
      );
    } catch (error) {
      log.error(
        'handle new friendship error',
        operatorId,
        Error.toLogFormat(error)
      );
    }

    directoryChangeQueue.add(() =>
      handleFriendshipChange(notifyTime, data, conversation)
    );
  }

  async function fullLoadGroup(notifyTime, conversation) {
    // full load group
    try {
      // const existingExpiry = conversation.get('messageExpiry');
      const exsitingName = conversation.get('name');
      const existingMembers = conversation.get('members') || [];
      const existingPublishRule = conversation.get('publishRule');

      await conversation.apiLoadGroupV2();
      await window.Signal.Data.updateConversation(conversation.attributes);

      let groupUpdate = {};

      if (conversation.get('disbanded')) {
        groupUpdate.disbanded = true;
      } else {
        if (exsitingName != conversation.get('name')) {
          groupUpdate.name = conversation.get('name');
        }

        if (existingPublishRule !== conversation.get('publishRule')) {
          if (conversation.get('publishRule') === 1) {
            groupUpdate.publishRule = conversation.get('publishRule');
          }
        }
        const joined = _.difference(
          conversation.get('members'),
          existingMembers
        );
        if (joined.length > 0) {
          groupUpdate.joined = joined;
        }

        // left
        const left = _.difference(existingMembers, conversation.get('members'));
        if (left.length > 0) {
          if (left.includes(ourNumber)) {
            // myself was removed
            conversation.set({ left: true });
          }
          groupUpdate.left = left;
        }
      }

      await conversation.saveNewLocalMessage({
        sent_at: notifyTime,
        group_update: groupUpdate,
        serverTimestamp: notifyTime,
      });

      // const currentExpiry = conversation.get('messageExpiry');
      // if (existingExpiry != currentExpiry && currentExpiry > 0) {
      //   await conversation.saveNewLocalMessage({
      //     sent_at: notifyTime,
      //     serverTimestamp: notifyTime,
      //     messageExpiryUpdate: { messageExpiry: currentExpiry },
      //   });
      // }
    } catch (error) {
      log.error('[', notifyTime, '] load groupV2 failed, ', error);
    }
  }

  function conversationUnSticky(conversation) {
    if (!conversation) return;
    const id = conversation.get('id');
    const isStick = conversation.get('isStick');
    if (isStick) Whisper.events.trigger('conversationStick', id, !isStick);
  }

  const commonNoActiveNotifyTypes = [
    NOTIFY_DETAILED_TYPE.LEAVE_GROUP,
    NOTIFY_DETAILED_TYPE.GROUP_ADD_ADMIN,
    NOTIFY_DETAILED_TYPE.GROUP_DEL_ADMIN,
    NOTIFY_DETAILED_TYPE.GROUP_CHANGE_RAPID_ROLE,
    NOTIFY_DETAILED_TYPE.GROUP_MSG_EXPIRY_CHANGE,
    NOTIFY_DETAILED_TYPE.GROUP_PUBLISH_ONLY_GROUP_RULE_CHANGE,
    NOTIFY_DETAILED_TYPE.GROUP_ADD_PIN,
    NOTIFY_DETAILED_TYPE.GROUP_DEL_PIN,
    NOTIFY_DETAILED_TYPE.GROUP_AVATAR_CHANGE,
    NOTIFY_DETAILED_TYPE.GROUP_REMIND_CHANGE,
    NOTIFY_DETAILED_TYPE.DISMISS_GROUP,
  ];

  const specialNoActiveNotifyTypes = [
    NOTIFY_DETAILED_TYPE.INVITE_JOIN_GROUP,
    NOTIFY_DETAILED_TYPE.KICKOUT_GROUP,
    NOTIFY_DETAILED_TYPE.GROUP_CHANGE_OWNER,
  ];

  // docs/apis/managed_group_notifyMsg.md
  async function handleGroupChangeNotification(
    idV1,
    idV2,
    groupNotifyType,
    conversation,
    notifyTime,
    groupVersion,
    data,
    display
  ) {
    log.info('[', idV2, notifyTime, '] handle begin for notifcation');

    const {
      group,
      members,
      operator,
      operatorDeviceId,
      groupRemind,
      groupNotifyDetailedType,
    } = data;
    const changeVersion = groupVersion;
    const ourNumber = textsecure.storage.user.getNumber();
    const deviceId = textsecure.storage.user.getDeviceId();

    if (operator === ourNumber && operatorDeviceId == deviceId) {
      // this change notfication caused by our some operations,
      // and all updates have been handle by ourself already,
      // so, we do not need to handle this.
      log.warn(
        '[',
        idV2,
        notifyTime,
        '] notfication caused by ourself operation, skipping...'
      );

      const updateAttributes = { changeVersion };

      const latestMessageTimestamp = conversation.get('latestMessageTimestamp');
      if (!latestMessageTimestamp || latestMessageTimestamp < notifyTime) {
        // updateAttributes.active_at = notifyTime;
        if (
          commonNoActiveNotifyTypes.includes(groupNotifyDetailedType) ||
          specialNoActiveNotifyTypes.includes(groupNotifyDetailedType)
        ) {
          //这种情况不更新active_at
        } else {
          updateAttributes.active_at = notifyTime;
        }
      }

      conversation.set(updateAttributes);

      if (members && members.length > 0) {
        const addedMembers = members.filter(
          m => m.action === CHANGE_ACTION.ADD
        );
        const updatedMembers = members.filter(
          m => m.action === CHANGE_ACTION.UPDATE
        );

        // changed numbers array
        const changedArray = members.map(m => m.uid) || [];
        // 从 conversation 中获取，'members' 以 'membersV2' 中数据为准
        const existMembersV2 = conversation.get('membersV2') || [];
        const addedMembersV2 =
          addedMembers.map(m => {
            return {
              id: m.uid,
              role: m.role,
              displayName: m.displayName,
            };
          }) || [];
        const updatedMembersV2 = updatedMembers.map(m => ({
          id: m.uid,
          role: m.role,
          displayName: m.displayName,
        }));

        // added members may already exists, members should respect data from server
        let changedMembersV2 =
          existMembersV2.filter(m => !changedArray.includes(m.id)) || [];
        changedMembersV2 = changedMembersV2.concat(addedMembersV2);
        changedMembersV2 = changedMembersV2.concat(updatedMembersV2);

        conversation.set({ membersV2: changedMembersV2 });
      }
      if (conversation.hasChanged()) {
        await window.Signal.Data.updateConversation(conversation.attributes);
      }
      return;
    }

    // group remindCycle
    if (groupNotifyType === NOTIFY_TYPE.CHANGE_GROUP_REMIND_CYCLE) {
      const { remindCycle } = groupRemind || {};
      await conversation.saveNewLocalMessage({
        sent_at: notifyTime,
        serverTimestamp: notifyTime,
        active_at: notifyTime,
        remindCycleUpdate: {
          remindCycle,
          type: 'cycle',
        },
      });

      // 如果当前的通知过来的会话就是 打开的会话， 就不设置未读了
      const currentConversation = window.getCurrentOpenConversation();
      if (currentConversation?.id !== conversation.get('id')) {
        conversation.markAsUnread();
      }

      return;
    }

    if (groupNotifyType === NOTIFY_TYPE.CHANGE_MY_SETTINGS) {
      // myself group settings changed
      // this change do not lead to group version changed,
      // so we handle this before group version checking.
      // get latest info from server.
      try {
        await conversation.apiGetGroupV2Member(ourNumber);
        await window.Signal.Data.updateConversation(conversation.attributes);

        // 更新完 conversation 后刷新 MainMenu 的未读消息数量。
        window.getInboxCollection().updateUnreadCount();
      } catch (error) {
        log.error(
          '[',
          idV2,
          notifyTime,
          '] get me group member info failed,',
          error
        );
      }

      log.info('[', idV2, notifyTime, '] MY Settings changed.');
      return;
    }

    const lastChangeVersion = conversation.get('changeVersion') || 0;
    if (changeVersion <= lastChangeVersion) {
      log.warn(
        '[',
        idV2,
        notifyTime,
        '] skipping, local:',
        lastChangeVersion,
        'coming:',
        changeVersion
      );
      return;
    } else if (changeVersion > lastChangeVersion + 1) {
      log.warn(
        '[',
        idV2,
        notifyTime,
        '] full load, local:',
        lastChangeVersion,
        'coming:',
        changeVersion
      );

      if (display) {
        // should set group conversation active,
        // to make group conversation to be shown in conversation list
        const latestMessageTimestamp = conversation.get(
          'latestMessageTimestamp'
        );
        if (!latestMessageTimestamp || latestMessageTimestamp < notifyTime) {
          conversation.set({
            active_at: notifyTime,
            isArchived: false,
          });
        }
      }

      await fullLoadGroup(notifyTime, conversation);

      log.error('[', idV2, notifyTime, '] group notification handle done 1.');

      return;
    }

    // update for conversation
    let update = {
      changeVersion,
      group_version: 2,
      type: 'group',
    };

    // update  for group, used for message showing.
    let groupUpdate = {};
    let groupApiLoaded = false;

    switch (groupNotifyType) {
      case NOTIFY_TYPE.CHANGE_BASIC:
        // * create group (show message)
        // * disband group (show message)
        // * group basic info changed (show message)
        const groupAction = group.action;
        switch (groupAction) {
          case CHANGE_ACTION.ADD:
            if (group.name != conversation.get('name')) {
              update.name = group.name;
            }

            groupUpdate = mergeMembers(conversation, members);
          // ADD may include UPDATE infos, so do not break here
          // break;
          case CHANGE_ACTION.UPDATE:
            const testAttributes = {
              ...group,
              commonAvatar: conversation.parseGroupAvatar(group.avatar),
            };

            const updatedAttributes = conversation.updateAttributesGroup(
              testAttributes,
              true
            );

            if (updatedAttributes) {
              update = {
                ...update,
                ...updatedAttributes,
              };
              if (groupAction === CHANGE_ACTION.UPDATE) {
                if (update.publishRule) {
                  groupUpdate.publishRule = update.publishRule;
                }
              }
            }
            break;
          case CHANGE_ACTION.DELETE:
            groupUpdate.disbanded = true;
            groupUpdate.isDisbandByOwner = false;

            update = {
              ...update,
              disbanded: true,
              isDisbandByOwner: false,
              left: true,
              members: [],
              membersV2: [],
            };

            break;
          default:
            log.error(
              '[',
              idV2,
              notifyTime,
              '] unsupported action:',
              groupAction
            );
            break;
        }

        break;
      case NOTIFY_TYPE.CHANGE_MEMBERS:
        // * add members (show message)
        // * remove members (show message)
        const me = members.filter(m => m.uid === ourNumber);
        if (me && me.length > 0 && me[0].action === CHANGE_ACTION.ADD) {
          // me was added, fully load group.
          try {
            await conversation.apiLoadGroupV2();
            groupApiLoaded = true;
          } catch (error) {
            log.error('[', idV2, notifyTime, '] load groupV2 failed, ', error);
            return;
          }

          groupUpdate.joined = [ourNumber];

          const publishRule = conversation.get('publishRule');
          if (publishRule === 1) {
            groupUpdate.publishRule = publishRule;
          }

          if (conversation.isMeLeftGroup()) {
            log.warn('[', idV2, notifyTime, '] re-added to a left group');
            update.left = false;
          }
        } else {
          groupUpdate = mergeMembers(conversation, members, operator);
        }
        break;
      case NOTIFY_TYPE.CHANGE_MEMBER_INFO_RAPID:
      case NOTIFY_TYPE.CHANGE_MEMBER_INFO:
        // * member basic info changed
        // * member role changed (show message)
        // only when myself info changed should show message
        log.info('members info changed for group:', idV2);
        groupUpdate = mergeMembers(conversation, members);
        break;
      case NOTIFY_TYPE.CHANGE_ANNOUNCEMENT:
        // new announcement
        // announcement changed

        break;
      case NOTIFY_TYPE.CHANGE_PIN:
        log.warn('Unsupported group notify', groupNotifyType);

        break;
      default:
        log.error(
          '[',
          idV2,
          notifyTime,
          '] unknown notify type: ',
          groupNotifyType
        );
        return;
    }

    if (update.name) {
      groupUpdate.name = update.name;
    }
    if (update.commonAvatar) {
      groupUpdate.avatar = update.commonAvatar;
    }
    // update.expireTimer = expireTimer;

    // update active_at only when display is true
    // this will controll whether conversation should be shown
    // or what the sequence the conversion is shown.
    if (display) {
      const isIncludeMe = (members || []).filter(m => m.uid === ourNumber);
      const latestMessageTimestamp = conversation.get('latestMessageTimestamp');
      if (!latestMessageTimestamp || latestMessageTimestamp < notifyTime) {
        if (
          commonNoActiveNotifyTypes.includes(groupNotifyDetailedType) ||
          (specialNoActiveNotifyTypes.includes(groupNotifyDetailedType) &&
            !members?.some(m => m.uid === ourNumber)) ||
          (groupNotifyDetailedType ===
            NOTIFY_DETAILED_TYPE.GROUP_CHANGE_OWNER &&
            isIncludeMe &&
            isIncludeMe.length > 0 &&
            isIncludeMe[0].role !== 0)
        ) {
          // 这种情况不更新active_at
        } else {
          update.active_at = notifyTime;
        }
        update.isArchived = false;
      }
    }

    // update member's group display name for echo one's changes
    if (!groupApiLoaded) {
      await conversation.updateGroupContact();
    }

    // if (update.messageExpiry > 0) {
    //   await conversation.saveNewLocalMessage({
    //     sent_at: notifyTime,
    //     serverTimestamp: notifyTime,
    //     messageExpiryUpdate: {
    //       messageExpiry: update.messageExpiry,
    //     },
    //   });
    // }

    if (
      update.remindCycle &&
      group?.action === CHANGE_ACTION.UPDATE &&
      groupNotifyDetailedType === NOTIFY_DETAILED_TYPE.GROUP_REMIND_CHANGE
    ) {
      const _conversation = ConversationController.get(operator);
      const name = _conversation.getName() || _conversation.getNumber();
      await conversation.saveNewLocalMessage({
        sent_at: notifyTime,
        serverTimestamp: notifyTime,
        active_at: notifyTime,
        remindCycleUpdate: {
          remindCycle: update.remindCycle,
          name,
          type: 'immediate',
        },
      });
    }

    if (display && Object.keys(groupUpdate).length > 0) {
      await conversation.saveNewLocalMessage({
        sent_at: notifyTime,
        group_update: { ...groupUpdate, operator, operatorDeviceId },
        serverTimestamp: notifyTime,
      });
    }

    if (groupNotifyDetailedType === NOTIFY_DETAILED_TYPE.GROUP_DESTROY) {
      await conversation.destroyMessages(true);
    }

    if (
      update.disbanded ||
      update.left ||
      groupUpdate.disbanded ||
      groupUpdate.removed?.includes(ourNumber) ||
      groupUpdate.left === 'You'
    ) {
      await window.Signal.Data.deletePinMessagesByConversationId(idV1);

      conversationUnSticky(conversation);

      await conversation.destroyMessages(true);
      conversation.trigger('unload', 'handle disband/leave group notification');
      update.active_at = null;
    }

    // update conversation and save to database
    conversation.set(update);
    await window.Signal.Data.updateConversation(conversation.attributes);

    log.error('[', idV2, notifyTime, '] group notification handle done.');
  }

  async function handleDirectoryChange(notifyTime, data) {
    const { ver, directoryVersion, members } = data;

    if (ver != 1) {
      log.error(
        '[',
        idV2,
        notifyTime,
        '] directory notification version must be 1.'
      );
      return;
    }

    const oldDirectoryVersion = storage.get('directoryVersion', -1);
    if (oldDirectoryVersion + 1 === directoryVersion) {
      log.info('update by step');
    } else if (oldDirectoryVersion >= directoryVersion) {
      log.info('skipping smaller version.');
      return;
    } else {
      log.info('incoming version bigger then local， full load contact list.');

      // full load contact list.
      let fullLoadVersion = -1;
      try {
        const result = await textsecure.messaging.fetchDirectoryContacts();
        const contacts = result['contacts'];
        fullLoadVersion = result['directoryVersion'];

        await ConversationController.bulkCreateContactConversations(contacts);
      } catch (error) {
        window.log.error('full load directory contacts failed.', error);
        return;
      }

      if (fullLoadVersion) {
        storage.put('directoryVersion', fullLoadVersion);
      }

      return;
    }

    if (!(members instanceof Array)) {
      log.error('incoming directory change members is not array.');
      return;
    }

    const parsedMembers = await Promise.all(
      members.map(async member => {
        if (!member.remark) {
          return member;
        }
        try {
          const conversation = ConversationController.get(member.number);
          if (conversation) {
            if (conversation.isPrivate()) {
              member.remarkName = await conversation.decryptPrivateRemark(
                member.remark
              );
            }
            return member;
          } else {
            return member;
          }
        } catch (e) {
          console.log('parse directory member error', e);
          return member;
        }
      })
    );

    await ConversationController.bulkFreshContactConversation(
      parsedMembers,
      directoryVersion
    );
    storage.put('directoryVersion', directoryVersion);
  }

  const FRIENDSHIP_ACTION = {
    REQUEST: 1,
    CONFIRM: 2,
  };

  async function handleFriendshipChange(notifyTime, data, conversation) {
    const { directoryVersion, actionType, operatorInfo } = data;

    // friend request should be handled firstly
    if (conversation) {
      const latestAskedVersion = conversation.get('latestAskedVersion');
      if (!conversation.isDirectoryUser() && !latestAskedVersion) {
        try {
          await conversation.apiGetSharedConfig();
        } catch (error) {
          window.log.warn('apiGetSharedConfig failed', error);
        }
      }

      let update;

      switch (actionType) {
        case FRIENDSHIP_ACTION.CONFIRM: {
          // nowAskedVersion should be the version before confirm
          const nowAskedVersion = directoryVersion - 1;
          //  including latestAskedVersion === nowAskedVersion
          if (!latestAskedVersion || latestAskedVersion <= nowAskedVersion) {
            update = {
              latestAskedVersion: nowAskedVersion,
              friendRequesting: false,
              active_at: notifyTime,
              isArchived: false,
            };
          }
          break;
        }
        case FRIENDSHIP_ACTION.REQUEST: {
          const nowAskedVersion = directoryVersion;
          if (!latestAskedVersion || latestAskedVersion < nowAskedVersion) {
            update = {
              latestAskedVersion: nowAskedVersion,
              friendRequesting: true,
              active_at: notifyTime,
              isArchived: false,
            };
          }
          break;
        }
        default:
          break;
      }

      if (update) {
        conversation.set(update);

        if (update.friendRequesting) {
          await conversation.markAsUnread();
        }

        await conversation.forceUpdatePrivateContact();

        if (conversation.hasChanged()) {
          await window.Signal.Data.updateConversation(conversation.attributes);
        }
      }
    }

    const oldDirectoryVersion = storage.get('directoryVersion', -1);
    if (oldDirectoryVersion + 1 === directoryVersion) {
      log.info('update by step');
    } else if (oldDirectoryVersion >= directoryVersion) {
      log.info('skipping smaller version.');
      return;
    } else {
      log.info('incoming version bigger then local， full load contact list.');

      // full load contact list.
      let fullLoadVersion = -1;
      try {
        const result = await textsecure.messaging.fetchDirectoryContacts();
        const contacts = result['contacts'];
        fullLoadVersion = result['directoryVersion'];

        await ConversationController.bulkCreateContactConversations(contacts);
      } catch (error) {
        window.log.error('full load directory contacts failed.', error);
        return;
      }

      if (fullLoadVersion) {
        storage.put('directoryVersion', fullLoadVersion);
      }

      return;
    }

    switch (actionType) {
      case FRIENDSHIP_ACTION.CONFIRM:
        const { operatorName, avatar } = operatorInfo || {};

        conversation.set({
          name: operatorName,
          directoryUser: true,
          commonAvatar: conversation.parsePrivateAvatar(avatar),
        });
        await window.Signal.Data.updateConversation(conversation.attributes);

        storage.put('directoryVersion', directoryVersion);
        break;
      case FRIENDSHIP_ACTION.REQUEST:
        break;
      default:
        log.info('Unknown action type', actionType);
        break;
    }
  }

  async function queueConversationChangeHandler(notifyTime, data, display) {
    const { ver, conversation } = data;

    if (ver != 1) {
      log.error(
        '[',
        idV2,
        notifyTime,
        '] conversation notification version must be 1.'
      );
      return;
    }

    if (!conversation || !(conversation instanceof Object)) {
      window.log.info(
        'background queueConversationChangeHandler BAD DATA:',
        data
      );
      return;
    }

    const { version, conversation: conversationId } = conversation;
    if (!conversationId || !version) {
      window.log.info(
        'background queueConversationChangeHandler BAD conversation DATA:',
        conversation
      );
      return;
    }

    // 临时方案
    // 如果 conversationId 前带有 +，认为是联系人ID
    // 否则 conversationId 为群 idV2
    let conversationType;
    let id;

    if (conversationId.startsWith('+')) {
      conversationType = 'private';
      id = conversationId;
    } else {
      conversationType = 'group';
      id = window.Signal.ID.convertIdToV1(conversationId);
    }

    return ConversationController.getOrCreateAndWait(id, conversationType).then(
      conversation => {
        handleChangeConversationNotification(
          conversationId,
          conversation,
          notifyTime,
          ver,
          data,
          display
        );
      }
    );
  }

  async function handleChangeConversationNotification(
    id,
    conversation,
    notifyTime,
    ver,
    data,
    display
  ) {
    log.info(
      `[${id} ${notifyTime}]`,
      'handle begin for ConversationNotifcation'
    );
    const { operator, operatorDeviceId } = data;

    const ourNumber = textsecure.storage.user.getNumber();
    const deviceId = textsecure.storage.user.getDeviceId();
    if (operator === ourNumber && operatorDeviceId == deviceId) {
      log.warn(
        `[${id} ${notifyTime}]`,
        'ConversationNotfication caused by ourself operation, skipping...'
      );

      return;
    }

    // // changeType === 0: muteStatus change
    // if (changeType != 0 && changeType != 1 && changeType != 2) {
    //   window.log.info(
    //     `[${id} ${notifyTime}]`,
    //     'background queueConversationChangeHandler BAD BAD CHANGE TYPE!',
    //     changeType
    //   );
    //   return;
    // }

    const { version: settingVersion } = data.conversation;

    let updated;

    const lastSettingVersion = conversation.get('settingVersion') || 0;
    //settingVersion 相等时也要更新一下
    if (settingVersion <= lastSettingVersion) {
      log.warn(
        `[${id} ${notifyTime}]`,
        'skipping, local:',
        lastSettingVersion,
        'coming:',
        settingVersion
      );
      return;
    } else if (settingVersion === lastSettingVersion + 1) {
      log.warn(
        `[${id} ${notifyTime}]`,
        'update config by step, local:',
        lastSettingVersion,
        'coming:',
        settingVersion
      );

      updated = await conversation.updateConfig(data.conversation, true);
    } else if (settingVersion > lastSettingVersion + 1) {
      try {
        updated = await conversation.apiGetConfig();
      } catch (error) {
        window.log.error(
          `[${id} ${notifyTime}]`,
          'get conversation setting failed, ',
          error
        );
      }
    }

    if (updated && Object.hasOwn(updated, 'muteStatus')) {
      window.getInboxCollection().updateUnreadCount();
    }
  }

  async function handleSharedConfigChangeNotification(
    conversation,
    notifyTime,
    data
  ) {
    const { messageExpiry, messageClearAnchor, ver: newVersion } = data;

    const sharedVersion = conversation.get('sharedSettingVersion');

    if (sharedVersion >= newVersion) {
      window.log.info(
        'handleSharedConfigChangeNotification new version smaller than exists',
        sharedVersion,
        newVersion
      );
      return;
    } else if (sharedVersion + 1 === newVersion) {
      if (typeof messageExpiry != 'number' || messageExpiry <= 0) {
        window.log.info(
          'handleSharedConfigChangeNotification invalid messageExpiry',
          messageExpiry
        );
        // invalid messageExpiry
        return;
      }

      conversation.set({
        messageExpiry,
        messageClearAnchor: Math.max(
          conversation.getMessageClearAnchor(),
          messageClearAnchor
        ),
        sharedSettingVersion: newVersion,
      });
      await window.Signal.Data.updateConversation(conversation.attributes);

      // await conversation.saveNewLocalMessage({
      //   sent_at: notifyTime,
      //   serverTimestamp: notifyTime,
      //   messageExpiryUpdate: {
      //     messageExpiry: messageExpiry,
      //   },
      // });
    } else {
      try {
        await conversation.apiGetSharedConfig();
      } catch (error) {
        window.log.error(
          'failed to get shared config',
          Errors.toLogFormat(error)
        );
      }
    }
  }

  // {
  //   "notifyType": 5,
  //   "notifyTime": 1673858506376,
  //   "data": {
  //       "operator": "+77288809934",
  //       "operatorDeviceId": 1,
  //       "conversation": "+76058820562:+77288809934",
  //       "ver": 2,
  //       "changeType": 1,
  //       "messageExpiry": 180
  //   }
  // }
  async function queueConversationShareChangeHandler(notifyTime, data) {
    const {
      operator,
      operatorDeviceId,
      conversation: serverConversationId,
    } = data;

    const ourNumber = textsecure.storage.user.getNumber();
    const deviceId = textsecure.storage.user.getDeviceId();

    if (operator == ourNumber && deviceId == operatorDeviceId) {
      log.warn(
        `[${serverConversationId} ${notifyTime}]`,
        'covnersation SharedConfig change caused by ourself operation, skipping...'
      );
      return;
    }

    const numbers = serverConversationId.split(':');
    if (
      numbers.length != 2 ||
      !numbers.includes(ourNumber) ||
      !numbers.includes(operator)
    ) {
      window.log.error(
        `conversation: ${serverConversationId}`,
        'does not belong to the operator or me',
        `operator: ${operator}`
      );
      return;
    }

    const conversationId = numbers[0] === ourNumber ? numbers[1] : numbers[0];
    return ConversationController.getOrCreateAndWait(
      conversationId,
      'private'
    ).then(conversation => {
      handleSharedConfigChangeNotification(conversation, notifyTime, data);
    });
  }

  // notifyType: 8
  async function handleReminderChange(notifyTime, data, conversation) {
    const {
      conversation: cid,
      version,
      timestamp,
      changeType,
      idV1,
      description,
      creator,
      reminderId,
    } = data || {};
    log.info(
      '[',
      cid,
      notifyTime,
      '] handle begin for reminder notification:',
      timestamp
    );
    const expireTimer = conversation.getConversationMessageExpiry();

    let reminderList = conversation.get('reminderList') || [];
    const reminder =
      reminderList?.find(r => r?.reminderId === reminderId) || data;

    // changeType: 1-新增, 2-修改, 3-删除, 4-提醒
    if (version < reminder?.version) {
      log.warn(
        '[',
        cid,
        notifyTime,
        '] skipping, local:',
        reminder?.version,
        'coming:',
        version
      );
      return;
    }

    // changeType: 1-新增, 2-修改, 3-删除, 4-提醒
    switch (changeType) {
      case 1:
      case 2:
        reminderList = reminderList.filter(r => r?.reminderId !== reminderId);
        reminderList.push(data);
        break;
      case 3:
        reminderList = reminderList.filter(r => r?.reminderId !== reminderId);
        break;
      default:
        console.log('update reminder list and then continue...');
    }

    let updateAttribute = {
      reminderList,
    };

    let messageAttribute = {
      sent_at: notifyTime,
      serverTimestamp: notifyTime,
    };

    let creatorName;
    const c = ConversationController.get(creator);
    if (c) {
      creatorName = c.getName();
    }
    let displayText = '';
    if (changeType === 1) {
      displayText = `@${creatorName} ${i18n('createdReminder')}`;
    } else if (changeType === 2) {
      displayText = `@${creatorName} ${i18n('changedReminder')}`;
    } else if (changeType === 3) {
      displayText = `@${creatorName} ${i18n('deletedReminder')}`;
    } else if (changeType === 4) {
      displayText = `${i18n('reminderBy')} @${creatorName}: ${description}`;

      updateAttribute = {
        ...updateAttribute,
        unreadCount: conversation.get('unreadCount') + 1,
        active_at: Date.now(),
      };

      messageAttribute = {
        ...messageAttribute,
        type: 'incoming',
      };
    } else {
      log.warn('[', cid, notifyTime, ']', 'unknown changeType');
      return;
    }

    const message = await conversation.saveNewLocalMessage({
      ...messageAttribute,
      source: window.textsecure.storage.user.getNumber(),
      reminderNotifyUpdate: {
        description,
        creatorName,
        displayText,
      },
      expireTimer,
    });

    //  4-通知 需要提醒
    if (changeType === 4) {
      await conversation.notify(message);
    }

    conversation.set({
      ...updateAttribute,
    });

    await window.Signal.Data.updateConversation(idV1, conversation.attributes, {
      Conversation: Whisper.Conversation,
    });
  }
})();
