/* global
  getAccountManager,
  Whisper,
  i18n,
  log,
*/

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.StandaloneRegistrationView = Whisper.View.extend({
    templateName: 'standalone',
    className: 'full-screen-flow',
    initialize() {
      this.accountManager = getAccountManager();

      this.render();
      this.$('#error').hide();
      this.$('.waiting').hide();
    },
    render_attributes() {
      return {
        registerHeader: i18n('registerHeader'),
        registerButton: i18n('registerButton'),
        registerWarning: i18n('registerWarning'),
        dataLoadingText: i18n('dataLoadingText'),
      };
    },
    events: {
      'click #showRegister': 'showRegister',
    },

    async doLogin(inputValue) {
      // 1. 32位邀请码
      const inviteExp = /[a-zA-Z0-9]{32}/;
      if (inviteExp.test(inputValue)) {
        await this.regWithInviteCode(inputValue);
        return;
      }

      // 2. 17位验证码
      const vCodeExp = /\d{17}/;
      if (vCodeExp.test(inputValue)) {
        await this.regWithVerifyCode(
          `+${inputValue.substr(0, 11)}`,
          inputValue.substr(11, 6)
        );
        return;
      }

      try {
        throw new Error('Invalid input code');
      } catch (error) {
        this.displayError(error);
        return;
      }
    },

    async showRegister() {
      this.displayError('');

      this.Register = new Whisper.ReactWrapperView({
        className: 'button',
        Component: window.Signal.Components.Register,
        // eslint-disable-next-line no-undef
        props: {
          doLogin: value => this.doLogin(value),
        },
      });
    },
    async showPrompt({ title, content }) {
      const { promise, resolve, reject } = Promise.withResolvers();

      this.promptView = new Whisper.ReactWrapperView({
        Component: window.Signal.Components.Prompt,
        props: {
          title,
          content,
          onCancel: () => {
            this.promptView.remove();
            this.promptView = null;
            reject();
          },
          onOk: value => {
            this.promptView.remove();
            this.promptView = null;
            resolve(value);
          },
        },
      });

      return promise;
    },
    async regWithInviteCode(inviteCode) {
      this.displayError('');

      let response;
      try {
        response = await this.accountManager.redeemAccount(inviteCode);
        const { verificationCode, account: number } = response;
        await this.accountManager.requestSMSVerification(number);

        // 输入名字
        let inputValue;
        while (!inputValue) {
          try {
            inputValue = await this.showPrompt({
              title: i18n('registerButton'),
              content: 'Enter Your Name',
            });
            // eslint-disable-next-line no-empty
          } catch (e) {}
        }

        await this.accountManager
          .registerSingleDevice(number, verificationCode, undefined, inputValue)
          .then(() => {
            this.$el.trigger('openInbox');
            window.removeSetupMenuItems();
          });
      } catch (err) {
        this.displayError(err);
      }
    },
    async regWithVerifyCode(number, verificationCode) {
      this.displayError('');

      try {
        const response =
          await this.accountManager.requestSMSVerification(number);
        let pinCode;
        if (response.requirePin) {
          try {
            pinCode = await this.showPrompt({
              title: 'Pin Code',
              content: 'Input your pin code',
            });
            // eslint-disable-next-line no-empty
          } catch (e) {}

          if (!pinCode) {
            // eslint-disable-next-line no-throw-literal
            throw 'Need Pin Code';
          }
        }

        await this.accountManager
          .registerSingleDevice(number, verificationCode, pinCode)
          .then(() => {
            this.$el.trigger('openInbox');
            window.removeSetupMenuItems();
          });
      } catch (err) {
        this.displayError(err);
        // this.$('#standalone-waiting3').hide();
        // this.$('#regWithVerifyCode').prop('disabled', false);
      }
    },
    displayError(error) {
      let showError = error;
      if (error.response || error.message) {
        if (typeof error.response === 'string') {
          showError = error.response;
        } else if (typeof error.message === 'string') {
          showError = error.message;
        } else {
          showError = JSON.stringify(error.response);
        }
      }

      this.$('#error').hide().text(showError).addClass('in').fadeIn();
    },
  });
})();
