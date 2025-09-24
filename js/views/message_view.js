/* global Whisper: false */

// eslint-disable-next-line func-names

(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.MessageView = Whisper.View.extend({
    tagName: 'li',
    id() {
      return this.model.id;
    },

    events: {
      onShow: 'onShow',
      destroy: 'onDestroy',
    },

    initialize(options) {
      this.listMode = options.listMode;
      this.observer = options.observer;

      this.isInMainList = this.listMode === 'main';

      this.listenTo(this.model, 'change', this.onChange);
      this.listenTo(this.model, 'destroy', this.onDestroy);
      this.listenTo(this.model, 'unload', this.onUnload);
      this.listenTo(this.model, 'expired', this.onExpired);
      this.listenTo(this.model, 'recalled', this.onUnload);
      this.listenTo(this.model, 'change:translateLang change:body', () => {
        this.model.trigger('update-translate-cache', this.model);
      });

      if (this.observer) {
        this.observer.observe(this.el);
      }

      this.triggerUpdateTranslate = _.debounce(
        () => {
          this.model.trigger('update-translate-cache', this.model);
        },
        5000,
        true
      );
    },

    onShow() {
      if (this.childView) {
        this.triggerUpdateTranslate();
      }
    },
    onChange() {
      this.addId();
    },
    addId() {
      // The ID is important for other items inserting themselves into the DOM. Because
      //   of ReactWrapperView and this view, there are two layers of DOM elements
      //   between the parent and the elements returned by the React component, so this is
      //   necessary.
      const { id } = this.model;
      this.$el.attr('id', id);
    },
    onExpired() {
      setTimeout(() => this.onUnload(), 1000);
    },
    onUnload(options) {
      const { listMode } = options || {};
      if (!listMode) {
        // do no specific listMode in options, continue to unload
      } else if (this.listMode === listMode) {
        // listMode is matched, continue to unload
      } else {
        // not matched, do nothing.
        return;
      }

      if (this.observer) {
        this.observer.unobserve(this.el);
      }

      if (this.childView) {
        this.childView.remove();
        this.childView = null;
      }

      if (this.throttledUpdate) {
        const throttled = this.throttledUpdate;
        this.throttledUpdate = null;
        throttled.cancel();
      }

      this.remove();
    },
    onDestroy() {
      this.onUnload();
    },
    getRenderInfo() {
      const { Components } = window.Signal;

      if (this.model.propsForTimerNotification) {
        return {
          Component: Components.TimerNotification,
          props: this.model.propsForTimerNotification,
        };
      } else if (this.model.propsForTipsNotification) {
        return {
          Component: Components.TipsNotification,
          props: this.model.propsForTipsNotification,
        };
      } else if (this.model.propsForSafetyNumberNotification) {
        return {
          Component: Components.SafetyNumberNotification,
          props: this.model.propsForSafetyNumberNotification,
        };
      } else if (this.model.propsForVerificationNotification) {
        return {
          Component: Components.VerificationNotification,
          props: this.model.propsForVerificationNotification,
        };
      } else if (this.model.propsForResetSessionNotification) {
        return {
          Component: Components.ResetSessionNotification,
          props: this.model.propsForResetSessionNotification,
        };
      } else if (this.model.propsForGroupNotification) {
        return {
          Component: Components.GroupNotification,
          props: this.model.propsForGroupNotification,
        };
      } else if (this.model.propsForRecallMessageNotification) {
        return {
          Component: Components.RecallMessageNotification,
          props: this.model.propsForRecallMessageNotification,
        };
      } else if (this.model.propsForTranslateChangeNotification) {
        return {
          Component: Components.TranslateChangeNotification,
          props: this.model.propsForTranslateChangeNotification,
        };
      } else if (this.model.propsForMessageExpiryNotification) {
        return {
          Component: Components.MessageExpiryNotification,
          props: this.model.propsForMessageExpiryNotification,
        };
      } else if (this.model.propsForRemindCycleNotification) {
        return {
          Component: Components.RemindCycleNotification,
          props: this.model.propsForRemindCycleNotification,
        };
      } else if (this.model.propsForReminderNotification) {
        return {
          Component: Components.ReminderNotification,
          props: this.model.propsForReminderNotification,
        };
      } else if (this.model.propsForScreenshotNotification) {
        return {
          Component: Components.ScreenshotNotification,
          props: this.model.propsForScreenshotNotification,
        };
      } else if (this.model.propsForIdentityKeyResetNotification) {
        return {
          Component: Components.IdentityKeyResetNotification,
          props: this.model.propsForIdentityKeyResetNotification,
        };
      }

      return {
        Component: Components.Message,
        props: {
          ...this.model.propsForMessage,
          virtualIndex: this.model.virtualIndex,
          dateSeparator: this.model.dateSeparator,
        },
      };
    },
    render() {
      this.addId();

      if (this.childView) {
        this.childView.remove();
        this.childView = null;
      }

      if (this.model.isExpired()) {
        window.log.error(
          'skipping render expired',
          this.model.idForLogging(),
          this.model.get('conversationId')
        );

        return this;
      }

      if (this.model.isRecallMessage()) {
        window.log.error(
          'skipping render recall notification',
          this.model.idForLogging(),
          this.model.get('conversationId')
        );

        return this;
      }

      const update = () => {
        // expired message do not loaded
        if (this.model.isExpired()) {
          if (this.childView) {
            this.childView.remove();
            this.childView = null;
          }

          window.log.error(
            'skipping update expired',
            this.model.idForLogging(),
            this.model.get('conversationId')
          );
          return;
        }

        // if it's main list mode
        // threadOnly message should not be displayed
        const isInMainList = this.isInMainList;
        if (isInMainList && this.model.threadOnly) {
          if (this.childView) {
            this.childView.remove();
            this.childView = null;
          }

          return;
        }

        if (this.childView) {
          const info = this.getRenderInfo();
          this.childView.update({
            ...info.props,
            showThreadBar: isInMainList,
          });
        } else {
          const { Component, props } = this.getRenderInfo();

          try {
            this.childView = new Whisper.ReactWrapperView({
              className: 'message-wrapper-outer',
              Component,
              props: {
                ...props,
                showThreadBar: isInMainList,
              },
            });
            this.$el.append(this.childView.el);
          } catch (error) {
            log.error('create message view failed,', error);
          }
        }
      };

      // force update model props before loading if hasUnreadMembers
      // make sure all props up to date
      if (this.model.hasUnreadMembers()) {
        const { readMemberCount } = this.model.propsForMessage || {};
        if (readMemberCount !== this.model.getReadMemberCount()) {
          this.model.forceGenerateProps();
        }
      }

      this.listenTo(this.model, 'change', update);
      this.listenTo(this.model, 'expired', update);
      this.listenTo(this.model, 'change:external', update);

      if (this.isInMainList) {
        this.listenTo(this.model, 'threadOnlyChanged', update);
      }

      const applicableConversationChanges =
        'change:color change:name change:number change:profileName change:remarkName ' +
        'change:profileAvatar change:avatar change:commonAvatar update_view change:external';

      this.throttledUpdate = _lodash.throttle(() => {
        // make sure props generated properly
        this.model.forceGenerateProps();
        update();
      }, 1000);

      const doThrottledUpdate = () =>
        setTimeout(() => this.throttledUpdate?.(), 10);

      this.conversation = this.model.getConversation();
      if (this.conversation) {
        this.listenTo(
          this.conversation,
          applicableConversationChanges,
          doThrottledUpdate
        );

        if (this.model.hasUnreadMembers()) {
          this.listenTo(
            this.conversation,
            'change:read_by_at',
            doThrottledUpdate
          );
        }
      }

      this.fromContact = this.model.getContact();
      if (this.fromContact) {
        this.listenTo(
          this.fromContact,
          applicableConversationChanges,
          doThrottledUpdate
        );
      }

      this.quotedContact = this.model.getQuoteContact();
      if (this.quotedContact) {
        this.listenTo(
          this.quotedContact,
          applicableConversationChanges,
          doThrottledUpdate
        );
      }

      this.includeContact = this.model.getIncludeContact();
      if (this.includeContact) {
        this.listenTo(
          this.includeContact,
          applicableConversationChanges,
          doThrottledUpdate
        );
      }

      update();

      return this;
    },
  });
})();
