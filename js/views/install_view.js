/* global Whisper, i18n, getAccountManager, $, textsecure */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.InstallView = Whisper.View.extend({
    templateName: 'link-flow-template',
    className: 'main full-screen-flow',
    events: {},
    initialize(options = {}) {
      window.readyForUpdates();
      this.showLoginPage();

      // Keep data around if it's a re-link
      this.shouldRetainData = Whisper.Registration.everDone();
    },
    showLoginPage() {
      if (!this.loginView) {
        this.loginView = new Whisper.ReactWrapperView({
          className: 'login-view-wrapper',
          Component: window.Signal.Components.Login,
          props: {
            i18n,
          },
        });

        this.$el.append(this.loginView.el);
      }
    },
  });
})();
