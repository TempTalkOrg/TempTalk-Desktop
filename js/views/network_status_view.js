/* global Whisper, extension, Backbone, moment, i18n */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.NetworkStatusView = Whisper.View.extend({
    className: 'network-status',
    templateName: 'networkStatus',
    initialize() {
      window.log.info('initialize NetworkStatusView');

      this.$el.hide();

      // debounced update
      this.debouncedUpdate = _lodash.debounce(
        this.updateInside.bind(this),
        2000,
        {
          leading: false,
          maxWait: 5000,
          trailing: true,
        }
      );

      this.renderIntervalHandle = setInterval(this.update.bind(this), 5000);
      extension.windows.onClosed(() => {
        window.log.info('NetworkStatusView clearInterval.');
        clearInterval(this.renderIntervalHandle);
      });

      setTimeout(this.finishConnectingGracePeriod.bind(this), 5000);

      this.withinConnectingGracePeriod = true;
      this.setSocketReconnectInterval(null);

      window.addEventListener('online', this.update.bind(this));
      window.addEventListener('offline', this.update.bind(this));

      this.model = new Backbone.Model();
      this.listenTo(this.model, 'change', this.onChange);

      // update status at begining.
      // 解决更换设备后，重新登陆无法出现relink按钮的问题
      setTimeout(() => this.update(), 0);
    },
    onReconnectTimer(millis) {
      this.setSocketReconnectInterval(millis);
    },
    finishConnectingGracePeriod() {
      this.withinConnectingGracePeriod = false;
    },
    setSocketReconnectInterval(millis) {
      this.socketReconnectWaitDuration = moment.duration(millis);
    },
    navigatorOnLine() {
      return navigator.onLine;
    },
    getSocketStatus() {
      return window.getSocketStatus();
    },
    getNetworkStatus() {
      let message = '';
      let instructions = '';
      let hasInterruption = false;
      let action = null;
      let buttonClass = null;

      const socketStatus = this.getSocketStatus();
      switch (socketStatus) {
        case WebSocket.CONNECTING:
          message = i18n('connecting');
          this.setSocketReconnectInterval(null);
          break;
        case WebSocket.OPEN:
          this.setSocketReconnectInterval(null);
          break;
        case WebSocket.CLOSED:
        case WebSocket.CLOSING:
        default:
          message = i18n('disconnected');
          instructions = i18n('checkNetworkConnection');
          hasInterruption = true;
          break;
      }

      if (
        socketStatus === WebSocket.CONNECTING &&
        !this.withinConnectingGracePeriod
      ) {
        hasInterruption = true;
      }
      if (this.socketReconnectWaitDuration.asSeconds() > 0) {
        instructions = i18n('attemptingReconnection', [
          this.socketReconnectWaitDuration.asSeconds(),
        ]);
      }
      if (!this.navigatorOnLine()) {
        hasInterruption = true;
        message = i18n('offline');
        instructions = i18n('checkNetworkConnection');
      } else if (!Whisper.Registration.isDone()) {
        hasInterruption = true;
        message = i18n('unlinked');
        instructions = i18n('unlinkedWarning');
        action = i18n('relink');
        buttonClass = 'openInstaller';
      }

      return {
        message,
        instructions,
        hasInterruption,
        action,
        buttonClass,
      };
    },
    update(immediate) {
      this.debouncedUpdate();

      if (immediate) {
        this.debouncedUpdate.flush();
      }
    },
    updateInside() {
      const status = this.getNetworkStatus();
      this.model.set(status);

      // fix hide() may not take effect when hasInterruption is false
      if (
        !this.model.hasChanged() &&
        !this.model.get('hasInterruption') &&
        this.$el.is(':visible')
      ) {
        this.onChange();
      }
    },
    render_attributes() {
      return this.model.attributes;
    },
    onChange() {
      this.render();
      if (this.model.attributes.hasInterruption) {
        this.$el.slideDown();
      } else {
        this.$el.hide();
      }
    },
  });
})();
