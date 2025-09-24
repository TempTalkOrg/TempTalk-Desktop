/* global Whisper, i18n */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.ArchiveIndicatorView = Whisper.View.extend({
    className: 'module-archive-indicator',
    templateName: 'archive-indicator-view',
    initialize(options = {}) {
      this.expire_timer = options.expire_timer;
      this.render();
    },

    reset(expire_timer) {
      this.expire_timer = expire_timer;
      this.render();
    },

    render_attributes() {
      let archiveIndicatorMessage;
      // show this indicator only when expire_timer has positive value.
      if (typeof this.expire_timer === 'number' && this.expire_timer > 0) {
        const ONE_DAY = 24 * 60 * 60;
        const expire_day = Math.floor(this.expire_timer / ONE_DAY).toString();

        archiveIndicatorMessage = i18n('archiveIndicatorMessage', expire_day);
      } else {
        log.error('conversation message expiry is invalid:', this.expire_timer);
      }

      return {
        archiveIndicatorMessage,
      };
    },

    render() {
      Whisper.View.prototype.render.call(this);

      if (!this.tips) {
        this.tips = new Whisper.ReactWrapperView({
          Component: window.Signal.Components.TipsForArchiveIndicator,
          props: { i18n },
        });
      }

      this.$('.module-archive-indicator__content').append(this.tips.el);

      return this;
    },

    remove() {
      if (this.tips) {
        this.tips.remove();
        this.tips = null;
      }

      Backbone.View.prototype.remove.call(this);
    },
  });
})();
