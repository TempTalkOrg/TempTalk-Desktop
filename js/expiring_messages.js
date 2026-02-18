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

  const MIN_INTERVAL = 5 * 1000;

  function createCoalesceTask(
    taskQueue,
    fn,
    options = { interval: MIN_INTERVAL, priority: 1 }
  ) {
    let promise = null;
    let pending = false;
    const interval = Math.max(options?.interval ?? MIN_INTERVAL, 1);

    async function run() {
      try {
        await taskQueue.add(() => fn(), { priority: options?.priority ?? 1 });
      } catch (error) {
        window.log.warn('call error', error);
      } finally {
        promise = null;

        if (pending) {
          pending = false;
          setTimeout(checkAndRun, interval);
        }
      }
    }

    function checkAndRun() {
      if (promise) {
        pending = true;
        return promise;
      }

      promise = run();
      return promise;
    }

    return checkAndRun;
  }

  async function delayExpired(message) {
    await new Promise(r => setTimeout(r, 1));
    message.getConversation()?.trigger('expired', message);
  }

  async function delayRecalled(message) {
    await new Promise(r => setTimeout(r, 1));
    message.getConversation()?.trigger('recalled', message);
  }

  const messageCleanupBatcher = window.Signal.Util.createBatcher({
    name: 'messageCleanupBatcher',
    wait: 300,
    maxSize: 50,
    processBatch: async items => {
      // wait for remove batcher idle
      await window.Signal.Data.waitForRemoveMessagesBatcherIdle();

      window.log.info('[cleanup] About to clean up messages', items.length);

      const recalleds = [];
      const finalExpireds = [];
      const expireChanges = [];

      for (const item of items) {
        const message = MessageController.register(item.id, item);
        const timstamp = message.getServerTimestamp();
        const conversation = message.getConversation();

        if (conversation) {
          await conversation.loadReadPositions(timstamp, timstamp);

          if (message.isExpired()) {
            finalExpireds.push(message);
          } else if (message.isRecalledMessage()) {
            recalleds.push(message);
          } else {
            expireChanges.push(message);
          }
        } else {
          window.log.warn(
            '[cleanup] Message has no conversation',
            message.idForLogging()
          );
        }
      }

      window.log.info(
        '[cleanup] checked',
        recalleds.length,
        finalExpireds.length,
        expireChanges.length
      );

      if (finalExpireds.length) {
        window.log.info(
          '[cleanup] Message expired',
          finalExpireds.map(m => m.get('sent_at'))
        );

        // We delete after the trigger to allow the conversation time to process
        // the expiration before the message is removed from the database.
        await Promise.all(finalExpireds.map(m => delayExpired(m)));
      }

      if (recalleds.length) {
        window.log.info(
          '[cleanup] Message recalled',
          recalleds.map(m => m.get('sent_at'))
        );

        await Promise.all(recalleds.map(m => delayRecalled(m)));
      }

      if (expireChanges.length) {
        const updates = expireChanges
          .filter(m => m.get('expires_at'))
          .map(m => {
            m.updateExpiresAtMs();
            m.setToExpireWithoutSaving(true);
            return m.attributes;
          });

        if (updates.length) {
          await window.Signal.Data.saveMessages(updates);
        }
      }

      const start = Date.now();
      await window.Signal.Data.removeMessages([...recalleds, ...finalExpireds]);

      const delta = Date.now() - start;
      if (delta > 500) {
        window.log.warn(`[cleanup] delay to run next for cost:${delta}ms`);
        await new Promise(r => setTimeout(r, 2 * delta));
      }
    },
  });

  function checkFromController() {
    const messages = MessageController.getExpiredMessages();

    const count = messages?.length;
    window.log.info(`[cleanup] Controller found ${count} messages to expire`);

    if (!count) {
      return 0;
    }

    messages.forEach(m => messageCleanupBatcher.add(m));
    return count;
  }

  async function checkFromDatabase() {
    try {
      const messages = await window.Signal.Data.getExpiredMessages({
        MessageCollection: Whisper.MessageCollection,
      });

      const count = messages?.length;
      window.log.info(`[cleanup] DB found ${count} messages to expire`);

      if (!count) {
        return 0;
      }

      messages.forEach(m => messageCleanupBatcher.add(m));

      return count;
    } catch (error) {
      window.log.error('[cleanup] getExpiredMessages error', error);
    }

    return 0;
  }

  async function checkFromClearable() {
    try {
      const globalConfig = window.getGlobalConfig();
      const { disappearanceTimeInterval } = globalConfig || {};
      const { default: defaultTimer, messageTimer } = disappearanceTimeInterval;
      const defaultMessageExpiry = messageTimer?.default || defaultTimer;

      if (!defaultMessageExpiry) {
        throw new Error('defaultMessageExpiry is not found');
      }

      const { messages, done } = await window.Signal.Data.getClearableMessages({
        defaultMessageExpiry,
        Message: Whisper.Message,
      });

      messages.forEach(m => messageCleanupBatcher.add(m));
      window.log.info(`[cleanup] Found ${messages.length} clearable messages`);

      return done;
    } catch (error) {
      window.log.error('[cleanup] getClearableMessages error', error);
    }
  }

  const taskQueue = new window.PQueue({ concurrency: 1 });

  const clearableTask = createCoalesceTask(
    taskQueue,
    () => checkFromClearable(),
    { interval: MIN_INTERVAL, priority: 10 }
  );

  const expiringTask = createCoalesceTask(
    taskQueue,
    async () => {
      let total = checkFromController();
      total += await checkFromDatabase();

      if (total > 0) {
        expiringTask();
      } else {
        clearableTask();
      }
    },
    { interval: MIN_INTERVAL, priority: 20 }
  );

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
      clearableTask();
      return;
    }

    Whisper.ExpiringMessagesListener.nextExpiration = expiresAt;
    window.log.info(
      '[cleanup] next message expires',
      new Date(expiresAt).toISOString()
    );

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
    timeout = setTimeout(expiringTask, wait);

    // if there is no expires in 5 seconds, start destroy clearable first
    if (wait > 1000 * 5) {
      clearableTask();
    }
  }

  const throttledCheckExpiring = _.throttle(checkExpiringMessages, 1000 * 5);

  Whisper.ExpiringMessagesListener = {
    nextExpiration: null,
    init(events) {
      throttledCheckExpiring();
      events.on('timetravel', throttledCheckExpiring);
    },
    update: throttledCheckExpiring,
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
