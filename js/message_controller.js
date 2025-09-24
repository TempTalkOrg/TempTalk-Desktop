// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  const collection = new Backbone.Collection();

  collection.comparator = collection.comparator = (left, right) => {
    const leftExpiresAt = left.expirationTimestamp;
    const rightExpiresAt = right.expirationTimestamp;

    if (leftExpiresAt && leftExpiresAt) {
      return leftExpiresAt - rightExpiresAt;
    } else if (leftExpiresAt) {
      return -1;
    } else if (rightExpiresAt) {
      return 1;
    } else {
      return 0;
    }
  };

  const throttledResort = _.throttle(
    () =>
      setTimeout(() => {
        collection.sort();
        Whisper.Message?.refreshExpirationTimer();
      }, 0),
    10000
  );

  collection.on('update-expiration-timestamp', throttledResort);

  const messageLookup = Object.create(null);

  const SECOND = 1000;
  const MINUTE = SECOND * 60;
  const FIVE_MINUTES = MINUTE * 5;
  const HOUR = MINUTE * 60;

  function register(id, message) {
    const existing = messageLookup[id];
    if (existing) {
      messageLookup[id] = {
        message: existing.message,
        timestamp: Date.now(),
      };
      return existing.message;
    }

    messageLookup[id] = {
      message,
      timestamp: Date.now(),
    };

    collection.add(message);

    return message;
  }

  function unregister(id) {
    collection.remove(id);
    delete messageLookup[id];
  }

  function getById(id) {
    const existing = messageLookup[id];
    return existing && existing.message ? existing.message : undefined;
  }

  function cleanup() {
    const messages = Object.values(messageLookup);
    const now = Date.now();

    for (let i = 0, max = messages.length; i < max; i += 1) {
      const { message, timestamp } = messages[i];
      const conversation = message.getConversation();

      if (
        now - timestamp > FIVE_MINUTES &&
        (!conversation || !conversation.messageCollection.length)
      ) {
        unregister(message.id);
      }
    }
  }

  function _get() {
    return messageLookup;
  }

  function getNextExpiringTimestamp() {
    return collection.first()?.expirationTimestamp;
  }

  function getExpiredMessages() {
    const messages = [];

    _lodash.forEach(collection.models, message => {
      if (message.isExpired()) {
        messages.push(message);
      } else {
        return false;
      }
    });

    return messages;
  }

  setInterval(cleanup, HOUR);

  window.MessageController = {
    register,
    unregister,
    getById,
    cleanup,
    _get,
    getNextExpiringTimestamp,
    getExpiredMessages,
  };
})();
