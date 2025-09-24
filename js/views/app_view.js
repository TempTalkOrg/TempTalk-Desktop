/* global Backbone, Whisper, storage, _, ConversationController, $ */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.AppView = Backbone.View.extend({
    initialize() {
      this.inboxView = null;
      this.installView = null;

      this.applyTheme();
      this.applyHideMenu();
    },
    events: {
      'click .openInstaller': 'openInstaller', // NetworkStatusView has this button
      openInbox: 'openInbox',
    },
    async applyTheme() {
      const iOS = true; // storage.get('userAgent') === 'OWI';
      const theme = storage.get('theme-setting') || 'system';
      if (theme === 'system') {
        const temp = await window.getNativeSystemTheme();
        this.$el
          .removeClass('light-theme')
          .removeClass('dark-theme')
          .addClass(`${temp}-theme`);
      } else {
        this.$el
          .removeClass('light-theme')
          .removeClass('dark-theme')
          .addClass(`${theme}-theme`);
      }

      if (iOS) {
        this.$el.addClass('ios-theme');
      } else {
        this.$el.removeClass('ios-theme');
      }
    },
    applyHideMenu() {
      // const hideMenuBar = storage.get('hide-menu-bar', false);
      window.setAutoHideMenuBar(true);
      window.setMenuBarVisibility(false);
    },
    openView(view) {
      this.el.innerHTML = '';
      this.el.append(view.el);
      this.delegateEvents();

      window.setupWaterMark();
    },
    openInstaller(options = {}) {
      window.addSetupMenuItems();

      this.resetViews();
      const installView = new Whisper.InstallView(options);
      this.installView = installView;

      this.openView(this.installView);
    },
    closeInstaller() {
      if (this.installView) {
        this.installView.remove();
        this.installView = null;
      }
    },
    openStandalone() {
      // if (window.getEnvironment() !== 'production') {
      //   window.addSetupMenuItems();
      //   this.resetViews();
      //   this.standaloneView = new Whisper.StandaloneRegistrationView();
      //   this.openView(this.standaloneView);
      // }

      window.addSetupMenuItems();
      this.resetViews();
      this.standaloneView = new Whisper.StandaloneRegistrationView();
      this.openView(this.standaloneView);
    },
    closeStandalone() {
      if (this.standaloneView) {
        this.standaloneView.remove();
        this.standaloneView = null;
      }
    },
    resetViews() {
      this.closeInstaller();
      this.closeStandalone();
    },
    openInbox(options = {}) {
      // The inbox can be created before the 'empty' event fires or afterwards. If
      //   before, it's straightforward: the onEmpty() handler below updates the
      //   view directly, and we're in good shape. If we create the inbox late, we
      //   need to be sure that the current value of initialLoadComplete is provided
      //   so its loading screen doesn't stick around forever.

      // Two primary techniques at play for this situation:
      //   - background.js has two openInbox() calls, and passes initalLoadComplete
      //     directly via the options parameter.
      //   - in other situations openInbox() will be called with no options. So this
      //     view keeps track of whether onEmpty() has ever been called with
      //     this.initialLoadComplete. An example of this: on a phone-pairing setup.
      _.defaults(options, { initialLoadComplete: this.initialLoadComplete });

      window.log.info('open inbox');

      if (this.inboxView) {
        this.inboxView.networkStatusView.update(true);
      }

      this.closeInstaller();

      if (!this.inboxView) {
        // We create the inbox immediately so we don't miss an update to
        //   this.initialLoadComplete between the start of this method and the
        //   creation of inboxView.
        this.inboxView = new Whisper.InboxView({
          window,
          initialLoadComplete: options.initialLoadComplete,
        });
        return ConversationController.loadPromise().then(() => {
          this.openView(this.inboxView);
        });
      }

      if (!$.contains(this.el, this.inboxView.el)) {
        this.openView(this.inboxView);
      }
      window.focus(); // FIXME
      return Promise.resolve();
    },
    onEmpty() {
      const view = this.inboxView;

      this.initialLoadComplete = true;
      if (view) {
        view.onEmpty();
      }
    },
    onProgress(count) {
      const view = this.inboxView;
      if (view) {
        view.onProgress(count);
      }
    },
    openConversation(id, messageId, recentConversationSwitch, type) {
      if (id) {
        this.openInbox().then(() => {
          setTimeout(() => {
            this.inboxView.openConversation(
              id,
              messageId,
              recentConversationSwitch,
              type
            );
          }, 0);
        });
      }
    },
    openGroupChats() {
      this.openInbox().then(() => {
        this.inboxView.openGroupChats();
      });
    },
    openAllBots() {
      this.openInbox().then(() => {
        this.inboxView.openAllBots();
      });
    },
    deleteMessages(id, type) {
      if (this.inboxView) {
        this.inboxView.deleteMessages(id, type);
      }
    },
    conversationStick(id, stick) {
      if (this.inboxView) {
        this.inboxView.conversationStick(id, stick);
      }
    },
    conversationMute(id, mute) {
      if (this.inboxView) {
        this.inboxView.conversationMute(id, mute);
      }
    },
    conversationLeaveGroup(id) {
      if (this.inboxView) {
        this.inboxView.conversationLeaveGroup(id);
      }
    },
    conversationDisbandGroup(id) {
      if (this.inboxView) {
        this.inboxView.conversationDisbandGroup(id);
      }
    },

    conversationArchived(id) {
      if (this.inboxView) {
        this.inboxView.conversationArchived(id);
      }
    },

    fastJoinGroup(joinUrl, rejoin) {
      if (this.inboxView) {
        this.inboxView.fastJoinGroup(joinUrl, rejoin);
      }
    },
  });
})();
