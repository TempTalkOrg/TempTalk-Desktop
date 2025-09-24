/* global Signal:false */
/* global Backbone: false */

/* global drawAttention: false */
/* global i18n: false */
/* global isFocused: false */
/* global Signal: false */
/* global storage: false */
/* global Whisper: false */
/* global _: false */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};
  const { Settings } = Signal.Types;

  const SettingNames = {
    COUNT: 'count', //neither name or message
    NAME: 'name', //only name
    MESSAGE: 'message', //name & message
    OFF: 'off', //close
  };

  function filter(text) {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  Whisper.Notifications = new (Backbone.Collection.extend({
    initialize() {
      this.isEnabled = false;
      this.dontDistrub = false;
      this.on('add', this.update);
      this.on('remove', this.onRemove);

      this.lastNotification = null;

      // Testing indicated that trying to create/destroy notifications too quickly
      //   resulted in notifications that stuck around forever, requiring the user
      //   to manually close them. This introduces a minimum amount of time between calls,
      //   and batches up the quick successive update() calls we get from an incoming
      //   read sync, which might have a number of messages referenced inside of it.
      this.fastUpdate = this.update;
      this.update = _.debounce(this.update, 1000);
    },
    update() {
      if (this.lastNotification) {
        this.lastNotification.close();
        this.lastNotification = null;
      }

      const { isEnabled } = this;
      const isAppFocused = isFocused();
      // const isAudioNotificationEnabled =
      //   storage.get('audio-notification') || false;
      const isAudioNotificationEnabled =
        typeof storage.get('audio-notification') == 'undefined'
          ? true
          : storage.get('audio-notification');
      const isAudioNotificationSupported =
        Settings.isAudioNotificationSupported();
      const isNotificationGroupingSupported =
        Settings.isNotificationGroupingSupported();
      const numNotifications = this.length;
      const userSetting = this.getUserSetting();
      const { dontDistrub } = this;

      const status = Signal.Notifications.getStatus({
        isAppFocused,
        isAudioNotificationEnabled,
        isAudioNotificationSupported,
        isEnabled,
        numNotifications,
        userSetting,
      });

      window.log.info(
        'Update notifications:',
        Object.assign({}, status, {
          isNotificationGroupingSupported,
        })
      );

      if (status.type !== 'ok') {
        if (status.shouldClearNotifications) {
          this.reset([]);
        }

        return;
      }

      //dont distrub
      if (dontDistrub) {
        return;
      }

      const lastModel = this.last();
      if (lastModel.get('isShown')) {
        return;
      }
      lastModel.set({ isShown: true });

      let title;
      let message;
      let iconUrl;

      // NOTE: i18n has more complex rules for pluralization than just
      // distinguishing between zero (0) and other (non-zero),
      // e.g. Russian:
      // http://docs.translatehouse.org/projects/localization-guide/en/latest/l10n/pluralforms.html
      const newMessageCountLabel = `${numNotifications} ${
        numNotifications === 1 ? i18n('newMessage') : i18n('newMessages')
      }`;

      const last = lastModel.toJSON();
      switch (userSetting) {
        case SettingNames.COUNT:
          title = i18n('productionName');
          message = newMessageCountLabel;
          break;
        case SettingNames.NAME: {
          // eslint-disable-next-line prefer-destructuring
          const sender = last.sender;
          iconUrl = last.iconUrl;
          if (numNotifications === 1) {
            title = last.title;
            message = `${i18n('notificationFrom')} ${sender}`;
          } else {
            title = newMessageCountLabel;
            message = i18n('notificationMostRecentFrom');
            message += ` ${sender}`;
            if (last.isGroup) {
              message += ` In Group ${last.title}`;
            }
          }
          break;
        }
        case SettingNames.MESSAGE:
          const sender = last.sender;
          title = last.title;
          if (numNotifications === 1) {
            title = last.title;
            message = last.message;
          } else {
            title = newMessageCountLabel;
            message = `${i18n('notificationMostRecent')}`;
            if (last.isGroup) {
              message += ` ${last.title}`;
            } else {
              message += ` ${sender}`;
            }
            message += `\n${last.message}`;
          }
          // eslint-disable-next-line prefer-destructuring
          iconUrl = last.iconUrl;
          break;
        default:
          window.log.error(
            `Error: Unknown user notification setting: '${userSetting}'`
          );
          break;
      }

      // const shouldHideExpiringMessageBody =
      //   last.isExpiringMessage && Signal.OS.isMacOS();
      // if (shouldHideExpiringMessageBody) {
      //   message = i18n('newMessage');
      // }

      drawAttention();
      this.lastNotification = new Notification(title, {
        body: window.platform === 'linux' ? filter(message) : message,
        icon: iconUrl,
        //silent: !status.shouldPlayNotificationSound,
        silent: true,
      });

      if (status.shouldPlayNotificationSound) {
        //播放声音
        let notificationAudio = new Sound({
          loop: false,
          src: 'audio/Notifiction.mp3',
        });
        notificationAudio.play();
        notificationAudio = null;
      }

      this.lastNotification.onclick = () =>
        this.trigger('click', last.conversationId, last.id);

      // We continue to build up more and more messages for our notifications
      // until the user comes back to our app or closes the app. Then we’ll
      // clear everything out. The good news is that we'll have a maximum of
      // 1 notification in the Notification area (something like
      // ‘10 new messages’) assuming that `Notification::close` does its job.
    },
    getUserSetting() {
      return storage.get('notification-setting') || SettingNames.MESSAGE;
    },
    onRemove() {
      window.log.info('Remove notification');
      this.update();
    },
    clear() {
      window.log.info('Remove all notifications');
      this.reset([]);
      this.update();
    },
    // We don't usually call this, but when the process is shutting down, we should at
    //   least try to remove the notification immediately instead of waiting for the
    //   normal debounce.
    fastClear() {
      this.reset([]);
      this.fastUpdate();
    },
    enable() {
      const needUpdate = !this.isEnabled;
      this.isEnabled = true;
      if (needUpdate) {
        this.update();
      }
    },
    disable() {
      this.isEnabled = false;
    },
    setDontDistrub(enable) {
      this.dontDistrub = enable;
    },
  }))();
})();
