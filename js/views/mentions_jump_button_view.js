/* global Whisper, i18n */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.MentionsJumpButtonView = Whisper.View.extend({
    className: 'module-mentions-jump',
    templateName: 'mentions-jump-button-view',

    initialize(options = {}) {
      this.count = options.count || 0;
    },

    reset(count = 0) {
      if (!count) {
        this.remove();
        return;
      }

      this.count = count;
      this.render();
    },

    increment(count = 0) {
      this.count += count;
      this.render();
    },

    render_attributes() {
      return {
        buttonClass: 'module-scroll-down__button--new-messages',
        unreadCount: this.count > 99 ? '99+' : this.count,
      };
    },
  });
})();
