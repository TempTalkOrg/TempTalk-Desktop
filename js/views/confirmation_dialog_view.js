/* global Whisper, i18n */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.ConfirmationDialogView = Whisper.View.extend({
    className: 'confirmation-dialog modal',
    templateName: 'confirmation-dialog',
    initialize(options) {
      this.message = options.message;
      this.hideCancel = options.hideCancel;

      this.resolve = options.resolve;
      this.okText = options.okText || i18n('ok');

      this.reject = options.reject;
      this.cancelText = options.cancelText || i18n('cancel');

      this.okClassName = options.okClassName || '';

      this.render();
    },
    events: {
      keyup: 'onKeyup',
      'click .ok': 'ok',
      'click .cancel': 'cancel',
    },
    render_attributes() {
      return {
        message: this.message,
        showCancel: !this.hideCancel,
        cancel: this.cancelText,
        ok: this.okText,
        okClassName: this.okClassName,
      };
    },
    ok() {
      this.remove();
      if (this.resolve) {
        this.resolve();
      }
    },
    cancel() {
      this.remove();
      if (this.reject) {
        this.reject();
      }
    },
    onKeyup(event) {
      if (event.key === 'Escape' || event.key === 'Esc') {
        this.cancel();
      }
    },
    focusCancel() {
      this.$('.cancel').trigger('focus');
    },
    focusOk() {
      this.$('.ok').trigger('focus');
    },
  });

  window.whisperConfirm = message => {
    return new Promise((resolve, reject) => {
      const dialog = new Whisper.ConfirmationDialogView({
        message,
        resolve,
        reject,
      });

      $('.inbox').append(dialog.el);
      dialog.focusOk();
    })
      .then(() => true)
      .catch(() => false);
  };

  window.windowAlert = window.alert;
  window.alert = message => {
    if (window.Signal.OS.isLinux()) {
      const dialog = new Whisper.ConfirmationDialogView({
        message,
        hideCancel: true,
      });

      $('.inbox').append(dialog.el);
      dialog.focusOk();
    } else {
      windowAlert(message);
    }
  };
})();
