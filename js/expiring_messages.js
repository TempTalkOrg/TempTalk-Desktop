/* global
  _,
  Backbone,
  i18n,
  MessageController,
  moment,
  Whisper
*/

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  let destroyInProgress = null;

  function doDestroyExpiredMessages() {
    if (destroyInProgress) {
      return;
    }

    destroyInProgress = destroyExpiredMessages().finally(() => {
      destroyInProgress = null;
      throttledCheckExpiringMessages();
    });
  }

  const triggerExpired = async message => {
    // we have no search messages, so, just comment it
    // Whisper.events.trigger(
    //   'messageExpired',
    //   message.id,
    //   message.conversationId
    // );

    await new Promise(r => setTimeout(r, 1));

    const conversation = message.getConversation();
    if (conversation) {
      conversation.trigger('expired', message);
    }
    await message.cleanup();
  };

  async function destroyExpiredMessages() {
    try {
      const messages = MessageController.getExpiredMessages() || [];

      window.log.info(
        `MessageController found ${messages.length} messages to expire`
      );

      // wait for remove batcher idle
      await window.Signal.Data.waitForRemoveMessagesBatcherIdle();

      window.log.info('destroyExpiredMessages: Loading messages...');

      const expiredInDB =
        (await window.Signal.Data.getExpiredMessages({
          MessageCollection: Whisper.MessageCollection,
        })) || [];

      let expiredInDBCount = 0;
      const shouldUpdateMessages = [];
      for (const message of expiredInDB) {
        if (message.isExpired()) {
          messages.push(message);
          expiredInDBCount++;
        } else {
          shouldUpdateMessages.push(message);
        }
      }

      if (shouldUpdateMessages.length) {
        await window.Signal.Data.saveMessages(
          shouldUpdateMessages.map(message => {
            message.updateExpiresAtMs();
            message.set({ expires_at: message.expirationTimestamp });
            return message.attributes;
          })
        );
      }

      window.log.info(`DB found ${expiredInDBCount} messages to expire`);

      if (messages.length) {
        const expiredMessages = messages.map(dbMessage => {
          const message = MessageController.register(dbMessage.id, dbMessage);
          return message;
        });

        do {
          const expiredList = expiredMessages.splice(0, 20);

          const msgIds = [];
          const sendAts = [];
          const promises = [];

          expiredList.forEach(m => {
            msgIds.push(m.id);
            sendAts.push(m.get('sent_at'));
            promises.push(triggerExpired(m));
          });

          window.log.info('Message expired', { sentAt: sendAts });

          await Promise.all(promises);

          // We delete after the trigger to allow the conversation time to process
          // the expiration before the message is removed from the database.
          await window.Signal.Data._removeMessages(msgIds);

          const start = Date.now();
          await window.Signal.Data.waitForRemoveMessagesBatcherIdle();

          if (!expiredMessages.length) {
            break;
          }

          const delta = Date.now() - start;
          if (delta > 500) {
            await new Promise(r => setTimeout(r, 2 * delta));
          }
        } while (expiredMessages.length);
      }
    } catch (error) {
      window.log.error(
        'destroyExpiredMessages: Error deleting expired messages',
        error && error.stack ? error.stack : error
      );
    }

    window.log.info('destroyExpiredMessages: complete');
  }

  let timeout;
  async function checkExpiringMessages() {
    let expiresAt = MessageController.getNextExpiringTimestamp();

    // Look up the next expiring message and set a timer to destroy it
    const messages = await window.Signal.Data.getNextExpiringMessage({
      MessageCollection: Whisper.MessageCollection,
    });

    const next = messages.at(0);
    if (next) {
      expiresAt = Math.min(next.get('expires_at'), expiresAt || Infinity);
    }

    if (!expiresAt || expiresAt === Infinity) {
      return;
    }

    Whisper.ExpiringMessagesListener.nextExpiration = expiresAt;
    window.log.info('next message expires', new Date(expiresAt).toISOString());

    let wait = expiresAt - Date.now();

    // In the past
    if (wait < 0) {
      wait = 0;
    }

    // Too far in the future, since it's limited to a 32-bit value
    if (wait > 2147483647) {
      wait = 2147483647;
    }

    clearTimeout(timeout);
    timeout = setTimeout(doDestroyExpiredMessages, wait);
  }
  const throttledCheckExpiringMessages = _.throttle(
    checkExpiringMessages,
    1000
  );

  Whisper.ExpiringMessagesListener = {
    nextExpiration: null,
    init(events) {
      checkExpiringMessages();
      events.on('timetravel', throttledCheckExpiringMessages);
    },
    update: throttledCheckExpiringMessages,
  };

  const TimerOption = Backbone.Model.extend({
    getName() {
      return (
        i18n(['timerOption', this.get('time'), this.get('unit')].join('_')) ||
        moment.duration(this.get('time'), this.get('unit')).humanize()
      );
    },
    getAbbreviated() {
      return i18n(
        ['timerOption', this.get('time'), this.get('unit'), 'abbreviated'].join(
          '_'
        )
      );
    },
  });
  Whisper.ExpirationTimerOptions = new (Backbone.Collection.extend({
    model: TimerOption,
    getName(seconds = 0) {
      const o = this.findWhere({ seconds });
      if (o) {
        return o.getName();
      }
      return [seconds, 'seconds'].join(' ');
    },
    getAbbreviated(seconds = 0) {
      const o = this.findWhere({ seconds });
      if (o) {
        return o.getAbbreviated();
      }
      return [seconds, 's'].join('');
    },
  }))(
    [
      [0, 'seconds'],
      [5, 'seconds'],
      [10, 'seconds'],
      [30, 'seconds'],
      [1, 'minute'],
      [5, 'minutes'],
      [30, 'minutes'],
      [1, 'hour'],
      [6, 'hours'],
      [12, 'hours'],
      [1, 'day'],
      [1, 'week'],
    ].map(o => {
      const duration = moment.duration(o[0], o[1]); // 5, 'seconds'
      return {
        time: o[0],
        unit: o[1],
        seconds: duration.asSeconds(),
      };
    })
  );
})();
