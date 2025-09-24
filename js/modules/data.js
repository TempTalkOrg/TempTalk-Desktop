/* global window, setTimeout, IDBKeyRange */

const electron = require('electron');

const {
  cloneDeep,
  forEach,
  get,
  isFunction,
  isObject,
  map,
  merge,
  set,
} = require('lodash');

const { base64ToArrayBuffer, arrayBufferToBase64 } = require('./crypto');
const MessageType = require('./types/message');
const { createBatcher } = require('../../ts/util/batcher');
const { shouldTrace } = require('../../ts/logger/utils');

const { ipcRenderer } = electron;

// We listen to a lot of events on ipcRenderer, often on the same channel. This prevents
//   any warnings that might be sent to the console in that case.
ipcRenderer.setMaxListeners(0);

const DATABASE_UPDATE_TIMEOUT = 3 * 60 * 1000; // three minutes

const SQL_CHANNEL_KEY = 'sql-channel';
const ERASE_SQL_KEY = 'erase-sql-key';
const ERASE_ATTACHMENTS_KEY = 'erase-attachments';
const CLEANUP_ORPHANED_ATTACHMENTS_KEY = 'cleanup-orphaned-attachments';

const _jobs = Object.create(null);
const _DEBUG = false;
let _jobCounter = 0;
let _shuttingDown = false;
let _shutdownCallback = null;
let _shutdownPromise = null;

const channels = {};

module.exports = {
  _jobs,
  _cleanData,

  shutdown,
  close,
  removeDB,

  createOrUpdateIdentityKey,
  getIdentityKeyById,
  bulkAddIdentityKeys,
  removeIdentityKeyById,
  removeAllIdentityKeys,
  getAllIdentityKeys,

  getItemByIdBase64,

  createOrUpdatePreKey,
  getPreKeyById,
  bulkAddPreKeys,
  removePreKeyById,
  removeAllPreKeys,
  getAllPreKeys,

  createOrUpdateSignedPreKey,
  getSignedPreKeyById,
  getAllSignedPreKeys,
  bulkAddSignedPreKeys,
  removeSignedPreKeyById,
  removeAllSignedPreKeys,

  createOrUpdateItem,
  getItemById,
  getAllItems,
  bulkAddItems,
  removeItemById,
  removeAllItems,

  createOrUpdateSession,
  getSessionById,
  getSessionsByNumber,
  bulkAddSessions,
  removeSessionById,
  removeSessionsByNumber,
  removeAllSessions,
  getAllSessions,

  // sessions v2
  createOrUpdateSessionV2,
  getSessionV2ById,

  getConversationCount,
  getStickConversationCount,
  saveConversation,
  saveConversations,
  getConversationById,
  updateConversation,
  updateConversations,
  removeConversation,
  _removeConversations,

  getAllConversations,
  getAllConversationIds,
  getAllPrivateConversations,
  getAllGroupsInvolvingId,

  searchConversations,
  searchMessages,
  searchMessagesInConversation,

  getMessageCount,
  saveMessage,
  saveMessages,
  // saveMessagesLimit,
  saveMessagesWithBatcher,
  removeMessage,
  _removeMessages,
  waitForRemoveMessagesBatcherIdle,
  // getUnreadByConversation,
  // getUnreadByConversationAndMarkRead,

  removeAllMessagesInConversation,

  getMessageBySender,
  getMessageById,
  getAllMessages,
  getAllMessageIds,
  getMessagesBySentAt,
  getExpiredMessages,
  getOutgoingWithoutExpiresAt,
  getNextExpiringMessage,
  getMessagesByConversation,
  // getPrivateMessagesByConversation,
  // getGroupMessagesByConversation,
  // getPrivateMessagesByConversationNew,
  // getGroupMessagesByConversationNew,

  getUnprocessedCount,
  getAllUnprocessed,
  getUnprocessedById,
  saveUnprocessed,
  saveUnprocesseds,
  // updateUnprocessedAttempts,
  // updateUnprocessedWithData,
  updateUnprocessedsWithData,
  // updateUnprocessedRequiredProtocolVersion,
  removeUnprocessed,
  removeAllUnprocessed,
  deduplicateUnprocessed,
  getUnprocessedDuplicatedCount,

  getNextAttachmentDownloadJobs,
  saveAttachmentDownloadJob,
  resetAttachmentDownloadPending,
  setAttachmentDownloadJobPending,
  removeAttachmentDownloadJob,
  removeAllAttachmentDownloadJobs,

  removeAll,
  removeAllConfiguration,

  removeOtherData,
  cleanupOrphanedAttachments,

  // Returning plain JSON
  getMessagesNeedingUpgrade,
  getMessagesWithVisualMediaAttachments,
  getMessagesWithFileAttachments,

  // light task
  createOrUpdateLightTask,
  setTaskFirstCardMessage,
  linkTaskConversation,
  getLightTask,
  deleteLocalTask,
  deleteLightTask,
  getTaskRoles,
  getAllTasks,
  linkTaskMessage,
  getLinkedMessages,
  delLinkedMessages,
  updateTaskReadAtVersion,
  getLightTaskExt,
  setLightTaskExt,

  // vote
  createOrUpdateBasicVote,
  createOrUpdateChangeableVote,
  getVote,
  deleteVote,
  voteLinkMessage,
  getVoteLinkedMessages,
  delVoteLinkedMessages,

  getThreadMessagesUnreplied,
  findNewerThreadReplied,

  listThreadsWithNewestMessage,

  deletePinMessagesByConversationId,
  getPinMessagesByConversationId,
  getPinMessageById,

  saveReadPosition,
  saveReadPositions,
  topReadPosition,
  getReadPositions,
  getUnreadMessages,
  getUnreadMessageCount,
  findLastReadMessage,
  findLastMessageForMarkRead,
  findLastUserMessage,

  // mentions
  getMentionsYouMessage,
  getMentionsYouMessageCount,
  getMentionsAtYouMessage,
  getMentionsAtAllMessage,

  rebuildMessagesIndexesIfNotExists,
  rebuildMessagesTriggersIfNotExists,

  // get group member last active list except me
  getGroupMemberLastActiveList,

  // get unhandled recall message
  getUnhandledRecalls,
  getNextMessagesToCorrectTimer,

  // file risk
  saveFileRiskInfo,
  getFileRiskInfo,

  // url risk
  saveUrlRiskInfo,
  getUrlRiskInfo,

  accRemoveAll,
  accRemoveAllConfiguration,
};

// When IPC arguments are prepared for the cross-process send, they are JSON.stringified.
// We can't send ArrayBuffers or BigNumbers (what we get from proto library for dates).
function _cleanData(data) {
  const keys = Object.keys(data);
  for (let index = 0, max = keys.length; index < max; index += 1) {
    const key = keys[index];
    const value = data[key];

    if (value === null || value === undefined) {
      // eslint-disable-next-line no-continue
      continue;
    }

    if (isFunction(value.toNumber)) {
      // eslint-disable-next-line no-param-reassign
      data[key] = value.toNumber();
    } else if (Array.isArray(value)) {
      // eslint-disable-next-line no-param-reassign
      data[key] = value.map(item => _cleanData(item));
    } else if (isObject(value)) {
      // eslint-disable-next-line no-param-reassign
      data[key] = _cleanData(value);
    } else if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    ) {
      window.log.info(`_cleanData: key ${key} had type ${typeof value}`);
    }
  }
  return data;
}

async function _shutdown() {
  if (_shutdownPromise) {
    return _shutdownPromise;
  }

  _shuttingDown = true;

  const jobKeys = Object.keys(_jobs);
  window.log.info(
    `data.shutdown: starting process. ${jobKeys.length} jobs outstanding`
  );

  // No outstanding jobs, return immediately
  if (jobKeys.length === 0) {
    return null;
  }

  // Outstanding jobs; we need to wait until the last one is done
  _shutdownPromise = new Promise((resolve, reject) => {
    _shutdownCallback = error => {
      window.log.info('data.shutdown: process complete');
      if (error) {
        return reject(error);
      }

      return resolve();
    };
  });

  return _shutdownPromise;
}

function logJobId(id) {
  return 'c' + id;
}

function _makeJob(fnName) {
  if (_shuttingDown && fnName !== 'close') {
    throw new Error(
      `Rejecting SQL channel job (${fnName}); application is shutting down`
    );
  }

  _jobCounter += 1;
  const id = _jobCounter;

  if (_DEBUG) {
    window.log.info(`SQL channel job ${logJobId(id)} (${fnName}) started`);
  }
  _jobs[id] = {
    fnName,
    start: Date.now(),
  };

  return id;
}

function _updateJob(id, data) {
  const { resolve, reject } = data;
  const { fnName, start } = _jobs[id];

  _jobs[id] = {
    ..._jobs[id],
    ...data,
    resolve: value => {
      _removeJob(id);
      const end = Date.now();
      const delta = end - start;
      if (shouldTrace(delta)) {
        window.log.info(
          `SQL channel job ${logJobId(id)} (${fnName}) succeeded in ${delta}ms`
        );
      }
      return resolve(value);
    },
    reject: error => {
      _removeJob(id);
      const end = Date.now();
      window.log.info(
        `SQL channel job ${logJobId(id)} (${fnName}) failed in ${end - start}ms`
      );
      return reject(error);
    },
  };
}

function _removeJob(id) {
  if (_DEBUG) {
    _jobs[id].complete = true;
    return;
  }

  delete _jobs[id];

  if (_shutdownCallback) {
    const keys = Object.keys(_jobs);
    if (keys.length === 0) {
      _shutdownCallback();
    }
  }
}

function _getJob(id) {
  return _jobs[id];
}

ipcRenderer.on(
  `${SQL_CHANNEL_KEY}-done`,
  (event, jobId, errorForDisplay, result) => {
    const job = _getJob(jobId);
    if (!job) {
      throw new Error(
        `Received SQL channel reply to job ${logJobId(jobId)},` +
          ` but did not have it in our registry!`
      );
    }

    const { resolve, reject, fnName } = job;

    if (errorForDisplay) {
      return reject(
        new Error(
          `Error received from SQL channel job ${logJobId(jobId)}` +
            ` (${fnName}): ${errorForDisplay}`
        )
      );
    }

    return resolve(result);
  }
);

function makeChannel(fnName) {
  channels[fnName] = (...args) => {
    const jobId = _makeJob(fnName);

    return new Promise((resolve, reject) => {
      // electron>=9.0版本，ipc通信参数检查更加严格了，若对象不能被Clone，则抛出"An object could not be cloned"异常。
      // 不清楚 _cleanData 为什么不用json格式化，反而自己处理各种类型？？？
      try {
        ipcRenderer.send(SQL_CHANNEL_KEY, jobId, fnName, ...args);
      } catch (e) {
        const tmp = JSON.stringify(args);
        const newArgs = JSON.parse(tmp);
        ipcRenderer.send(SQL_CHANNEL_KEY, jobId, fnName, ...newArgs);
      }

      _updateJob(jobId, {
        resolve,
        reject,
        args: _DEBUG ? args : null,
      });

      setTimeout(
        () =>
          reject(
            new Error(
              `SQL channel job ${logJobId(jobId)} (${fnName}) timed out`
            )
          ),
        DATABASE_UPDATE_TIMEOUT
      );
    });
  };
}

forEach(module.exports, fn => {
  if (isFunction(fn)) {
    makeChannel(fn.name);
  }
});

function keysToArrayBuffer(keys, data) {
  const updated = cloneDeep(data);
  for (let i = 0, max = keys.length; i < max; i += 1) {
    const key = keys[i];
    const value = get(data, key);

    if (value) {
      set(updated, key, base64ToArrayBuffer(value));
    }
  }

  return updated;
}

function keysFromArrayBuffer(keys, data) {
  const updated = cloneDeep(data);
  for (let i = 0, max = keys.length; i < max; i += 1) {
    const key = keys[i];
    const value = get(data, key);

    if (value) {
      set(updated, key, arrayBufferToBase64(value));
    }
  }

  return updated;
}

// Top-level calls

async function shutdown() {
  // Stop accepting new SQL jobs, flush outstanding queue
  await _shutdown();

  // Close database
  await close();
}

// Note: will need to restart the app after calling this, to set up afresh
async function close() {
  await channels.close();
}

// Note: will need to restart the app after calling this, to set up afresh
async function removeDB() {
  await channels.removeDB();
}

// Identity Keys

const IDENTITY_KEY_KEYS = ['publicKey'];
async function createOrUpdateIdentityKey(data) {
  const updated = keysFromArrayBuffer(IDENTITY_KEY_KEYS, data);
  await channels.createOrUpdateIdentityKey(updated);
}
async function getIdentityKeyById(id) {
  const data = await channels.getIdentityKeyById(id);
  return keysToArrayBuffer(IDENTITY_KEY_KEYS, data);
}
async function bulkAddIdentityKeys(array) {
  const updated = map(array, data =>
    keysFromArrayBuffer(IDENTITY_KEY_KEYS, data)
  );
  await channels.bulkAddIdentityKeys(updated);
}
async function removeIdentityKeyById(id) {
  await channels.removeIdentityKeyById(id);
}
async function removeAllIdentityKeys() {
  await channels.removeAllIdentityKeys();
}
async function getAllIdentityKeys() {
  const keys = await channels.getAllIdentityKeys();
  return keys.map(key => keysToArrayBuffer(IDENTITY_KEY_KEYS, key));
}

// Pre Keys

async function createOrUpdatePreKey(data) {
  const updated = keysFromArrayBuffer(PRE_KEY_KEYS, data);
  await channels.createOrUpdatePreKey(updated);
}
async function getPreKeyById(id) {
  const data = await channels.getPreKeyById(id);
  return keysToArrayBuffer(PRE_KEY_KEYS, data);
}
async function bulkAddPreKeys(array) {
  const updated = map(array, data => keysFromArrayBuffer(PRE_KEY_KEYS, data));
  await channels.bulkAddPreKeys(updated);
}
async function removePreKeyById(id) {
  await channels.removePreKeyById(id);
}
async function removeAllPreKeys() {
  await channels.removeAllPreKeys();
}
async function getAllPreKeys() {
  const keys = await channels.getAllPreKeys();
  return keys.map(key => keysToArrayBuffer(PRE_KEY_KEYS, key));
}

// Signed Pre Keys

const PRE_KEY_KEYS = ['privateKey', 'publicKey'];
async function createOrUpdateSignedPreKey(data) {
  const updated = keysFromArrayBuffer(PRE_KEY_KEYS, data);
  await channels.createOrUpdateSignedPreKey(updated);
}
async function getSignedPreKeyById(id) {
  const data = await channels.getSignedPreKeyById(id);
  return keysToArrayBuffer(PRE_KEY_KEYS, data);
}
async function getAllSignedPreKeys() {
  const keys = await channels.getAllSignedPreKeys();
  return keys.map(key => keysToArrayBuffer(PRE_KEY_KEYS, key));
}
async function bulkAddSignedPreKeys(array) {
  const updated = map(array, data => keysFromArrayBuffer(PRE_KEY_KEYS, data));
  await channels.bulkAddSignedPreKeys(updated);
}
async function removeSignedPreKeyById(id) {
  await channels.removeSignedPreKeyById(id);
}
async function removeAllSignedPreKeys() {
  await channels.removeAllSignedPreKeys();
}

// Items

const ITEM_KEYS = {
  identityKey: ['value.pubKey', 'value.privKey'],
  senderCertificate: [
    'value.certificate',
    'value.signature',
    'value.serialized',
  ],
  signaling_key: ['value'],
  profileKey: ['value'],
};
async function createOrUpdateItem(data) {
  const { id } = data;
  if (!id) {
    throw new Error(
      'createOrUpdateItem: Provided data did not have a truthy id'
    );
  }

  const keys = ITEM_KEYS[id];
  const updated = Array.isArray(keys) ? keysFromArrayBuffer(keys, data) : data;

  await channels.createOrUpdateItem(updated);
}
async function getItemById(id) {
  const keys = ITEM_KEYS[id];
  const data = await channels.getItemById(id);

  return Array.isArray(keys) ? keysToArrayBuffer(keys, data) : data;
}
async function getAllItems() {
  const items = await channels.getAllItems();
  return map(items, item => {
    const { id } = item;
    const keys = ITEM_KEYS[id];
    return Array.isArray(keys) ? keysToArrayBuffer(keys, item) : item;
  });
}
async function bulkAddItems(array) {
  const updated = map(array, data => {
    const { id } = data;
    const keys = ITEM_KEYS[id];
    return Array.isArray(keys) ? keysFromArrayBuffer(keys, data) : data;
  });
  await channels.bulkAddItems(updated);
}
async function removeItemById(id) {
  await channels.removeItemById(id);
}
async function removeAllItems() {
  await channels.removeAllItems();
}

// Sessions

async function createOrUpdateSession(data) {
  await channels.createOrUpdateSession(data);
}
async function getSessionById(id) {
  const session = await channels.getSessionById(id);
  return session;
}
async function getSessionsByNumber(number) {
  const sessions = await channels.getSessionsByNumber(number);
  return sessions;
}
async function bulkAddSessions(array) {
  await channels.bulkAddSessions(array);
}
async function removeSessionById(id) {
  await channels.removeSessionById(id);
}
async function removeSessionsByNumber(number) {
  await channels.removeSessionsByNumber(number);
}
async function removeAllSessions(id) {
  await channels.removeAllSessions(id);
}
async function getAllSessions(id) {
  const sessions = await channels.getAllSessions(id);
  return sessions;
}

// sessions v2
async function createOrUpdateSessionV2(data) {
  await channels.createOrUpdateSessionV2(data);
}

async function getSessionV2ById(uid) {
  return await channels.getSessionV2ById(uid);
}

// 'at

// Conversation

async function getConversationCount() {
  return channels.getConversationCount();
}

async function getStickConversationCount() {
  return channels.getStickConversationCount();
}

async function saveConversation(data) {
  await channels.saveConversation(data);
}

async function saveConversations(data) {
  await channels.saveConversations(data);
}

async function getConversationById(id, { Conversation }) {
  const data = await channels.getConversationById(id);
  return new Conversation(data);
}

const updateConversationsBatcher = createBatcher({
  name: 'updateConversationsBatcher',
  wait: 300,
  maxSize: 30,
  processBatch: async items => {
    // We only care about the most recent update for each conversation
    const mostRecent = [];
    items.reduceRight((previous, current) => {
      const { id } = current;
      if (id && !previous.includes(id)) {
        previous.push(id);
        mostRecent.push(current);
      }

      return previous;
    }, []);

    window.log.info(
      `batch update conversations for ` +
        `${mostRecent.length} in ${items.length}`
    );

    if (mostRecent.length) {
      try {
        await updateConversations(mostRecent);
      } catch (error) {
        const errorInfo =
          error && error.stack ? error.stack : JSON.stringify(error);
        window.log.info('updateConversations failed', errorInfo);
      }
    }
  },
});

async function updateConversation(data) {
  updateConversationsBatcher.add(data);
}

async function updateConversations(data) {
  await channels.updateConversations(data);
}

async function removeConversation(id, { Conversation }) {
  const existing = await getConversationById(id, { Conversation });

  // Note: It's important to have a fully database-hydrated model to delete here because
  //   it needs to delete all associated on-disk files along with the database delete.
  if (existing) {
    await channels.removeConversation(id);
    await existing.cleanup();
  }
}

// Note: this method will not clean up external files, just delete from SQL
async function _removeConversations(ids) {
  await channels.removeConversation(ids);
}

async function getAllConversations({ ConversationCollection }) {
  const conversations = await channels.getAllConversations();

  const collection = new ConversationCollection();
  collection.add(conversations);
  return collection;
}

async function getAllConversationIds() {
  const ids = await channels.getAllConversationIds();
  return ids;
}

async function getAllPrivateConversations({ ConversationCollection }) {
  const conversations = await channels.getAllPrivateConversations();

  const collection = new ConversationCollection();
  collection.add(conversations);
  return collection;
}

async function getAllGroupsInvolvingId(id, { ConversationCollection }) {
  const conversations = await channels.getAllGroupsInvolvingId(id);

  const collection = new ConversationCollection();
  collection.add(conversations);
  return collection;
}

async function searchConversations(query) {
  const conversations = await channels.searchConversations(query);
  return conversations;
}

async function searchMessages(query, { limit } = {}) {
  const messages = await channels.searchMessages(query, { limit });
  return {
    query,
    messages,
  };
}

async function searchMessagesInConversation(
  query,
  conversationId,
  { limit } = {}
) {
  const messages = await channels.searchMessagesInConversation(
    query,
    conversationId,
    { limit }
  );
  return {
    query,
    messages,
  };
}

// Message

async function getMessageCount() {
  return channels.getMessageCount();
}

// remove message may cost heavily
// we just remove 10 per 300 ms
// after some testing, bulk remove 10 cost closely 290ms
const removeMessagesBatcher = createBatcher({
  name: 'removeMessagesBatcher',
  wait: 300,
  maxSize: 5,
  processBatch: async ids => {
    window.log.info(`batch remove messages count: ${ids.length}`);
    if (ids.length) {
      try {
        await channels.removeMessage(ids);
      } catch (error) {
        const errorInfo =
          error && error.stack ? error.stack : JSON.stringify(error);
        window.log.info('removeMessage failed', errorInfo);
      }
    }
  },
});

const MIN_SAVE_MESSAGES_BATCHER_SIZE = 1;
const MAX_SAVE_MESSAGES_BATCHER_SIZE = 50;
const MAX_SAVE_MESSAGES_BATCHER_TIME = 300;

const adjustSizeWithDefault = (currSize, maxSize, minSize) => {
  if (currSize >= maxSize) {
    return maxSize;
  } else if (currSize <= minSize) {
    return minSize;
  } else {
    return Math.floor(currSize);
  }
};

const adjustBatcherSize = currSize => {
  return adjustSizeWithDefault(
    currSize,
    MAX_SAVE_MESSAGES_BATCHER_SIZE,
    MIN_SAVE_MESSAGES_BATCHER_SIZE
  );
};

const saveMessagesBatcherOptions = {
  name: 'saveMessagesBatcher',
  wait: 150,
  maxSize: 1,
  finalMaxSize: MAX_SAVE_MESSAGES_BATCHER_SIZE,
  processBatch: async items => {
    // We only care about the most recent update for each messages
    const mostRecent = [];
    items.reduceRight((previous, current) => {
      const { id } = current;
      if (id && !previous.includes(id)) {
        previous.push(id);
        mostRecent.push(current);
      }

      return previous;
    }, []);

    const recentSize = mostRecent.length;
    while (mostRecent.length) {
      try {
        const { maxSize: currMaxSize } = saveMessagesBatcherOptions;
        const itemsRef = mostRecent.splice(0, currMaxSize);
        const refSize = itemsRef.length;

        window.log.info(
          'batch saveMessages for',
          `${recentSize} in ${items.length}`,
          `with batch ${refSize} of ${currMaxSize}`
        );

        const start = Date.now();
        await channels.saveMessages(_cleanData(itemsRef));
        const delta = Date.now() - start;

        let nextMaxSize = currMaxSize;

        if (delta >= 3 * MAX_SAVE_MESSAGES_BATCHER_TIME) {
          // >= 900 ms, decrease 1, set final max size
          nextMaxSize = adjustBatcherSize(refSize - 1);
          saveMessagesBatcherOptions.finalMaxSize = nextMaxSize;
        } else if (delta >= MAX_SAVE_MESSAGES_BATCHER_TIME) {
          // >= 300 ms, decrease 1,
          nextMaxSize = adjustBatcherSize(refSize - 1);
        } else if (delta < MAX_SAVE_MESSAGES_BATCHER_TIME / 4) {
          // < 50ms, increase 1,
          const { finalMaxSize } = saveMessagesBatcherOptions;
          if (refSize === currMaxSize && finalMaxSize > currMaxSize) {
            nextMaxSize = adjustBatcherSize(currMaxSize + 1);
          }
        } else {
          // 其他情况，不调整
          return;
        }

        if (nextMaxSize !== currMaxSize) {
          saveMessagesBatcherOptions.maxSize = nextMaxSize;
          window.log.info(
            'adjust saveMessages bulk size',
            `from ${currMaxSize} to ${nextMaxSize} for ${delta}`
          );
        }
      } catch (error) {
        const errorInfo =
          error && error.stack ? error.stack : JSON.stringify(error);
        window.log.info('saveMessages failed', errorInfo);
      }
    }
  },
};

const saveMessagesBatcher = createBatcher(saveMessagesBatcherOptions);

function saveMessagesWithBatcher(data) {
  const models = data instanceof Array ? data : [data];
  models.forEach(m => saveMessagesBatcher.add(m));
}

async function saveMessage(data, { forceSave, Message } = {}) {
  const id = await channels.saveMessage(_cleanData(data), { forceSave });
  Message.refreshExpirationTimer();
  return id;
}

async function saveMessages(arrayOfMessages, { forceSave } = {}) {
  await channels.saveMessages(_cleanData(arrayOfMessages), { forceSave });
}

async function saveMessagesLimit(arrayOfMessages, { forceSave } = {}) {
  const messageLen = arrayOfMessages.length;
  const maxCount = 50;

  let progress = 0;
  for (let i = 0; i < arrayOfMessages.length / maxCount; i++) {
    const start = i * maxCount;
    const end = start + maxCount;
    const updatedMessages = arrayOfMessages.slice(start, end);

    progress += updatedMessages.length;
    log.info(`saveMessagesLimit progress: ${progress}, total: ${messageLen}`);
    await channels.saveMessages(_cleanData(updatedMessages), { forceSave });
    await new Promise(r => setTimeout(r, 500));
  }
}

async function removeMessage(id, { Message }) {
  // const message = await getMessageById(id, { Message });

  // // Note: It's important to have a fully database-hydrated model to delete here because
  // //   it needs to delete all associated on-disk files along with the database delete.
  // if (message) {
  //   await channels.removeMessage(id);
  //   await message.cleanup();
  // }
  removeMessagesBatcher.add(id);
}

// Note: this method will not clean up external files, just delete from SQL
async function _removeMessages(ids) {
  ids.forEach(id => removeMessagesBatcher.add(id));
}

async function waitForRemoveMessagesBatcherIdle() {
  await removeMessagesBatcher.onIdle();
}

async function getMessageById(id, { Message }) {
  const message = await channels.getMessageById(id);
  if (!message) {
    return null;
  }

  return new Message(message);
}

// For testing only
async function getAllMessages({ MessageCollection }) {
  const messages = await channels.getAllMessages();
  return new MessageCollection(messages);
}

async function getAllMessageIds() {
  const ids = await channels.getAllMessageIds();
  return ids;
}

async function getMessageBySender(
  // eslint-disable-next-line camelcase
  { source, sourceDevice, sent_at, fromCurrentDevice },
  { Message }
) {
  const messages = await channels.getMessageBySender({
    source,
    sourceDevice,
    sent_at,
    fromCurrentDevice,
  });
  if (!messages || !messages.length) {
    return null;
  }

  return new Message(messages[0]);
}

// async function getUnreadByConversationAndMarkRead(
//   conversationId,
//   readAt,
//   { MessageCollection }
// ) {
//   const messages = await channels.getUnreadByConversationAndMarkRead(
//     conversationId,
//     readAt
//   );
//   return new MessageCollection(messages);
// }

async function getItemByIdBase64(id) {
  const data = await channels.getItemById(id);
  return data;
}

async function getMessagesByConversation(
  conversationId,
  {
    limit = 50,
    serverTimestamp = Number.MAX_VALUE,
    upward = true,
    equal = false,
    threadId,
    onlyUnread = false,
    MessageCollection,
  }
) {
  const messages = await channels.getMessagesByConversation(conversationId, {
    limit,
    serverTimestamp,
    upward,
    equal,
    threadId,
    onlyUnread,
  });

  return new MessageCollection(messages);
}

async function removeAllMessagesInConversation(
  conversationId,
  { MessageCollection }
) {
  let messages;
  do {
    // Yes, we really want the await in the loop. We're deleting 100 at a
    //   time so we don't use too much memory.
    // eslint-disable-next-line no-await-in-loop
    messages = await getMessagesByConversation(conversationId, {
      limit: 100,
      MessageCollection,
    });

    if (!messages.length) {
      return;
    }

    const ids = messages.map(message => message.id);

    // Note: It's very important that these models are fully hydrated because
    //   we need to delete all associated on-disk files along with the database delete.
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(messages.map(message => message.cleanup()));

    // eslint-disable-next-line no-await-in-loop
    await channels.removeMessage(ids);
  } while (messages.length > 0);
}

async function getMessagesBySentAt(sentAt, { MessageCollection }) {
  const messages = await channels.getMessagesBySentAt(sentAt);
  return new MessageCollection(messages);
}

async function getExpiredMessages({ MessageCollection }) {
  const messages = await channels.getExpiredMessages();
  return new MessageCollection(messages);
}

async function getOutgoingWithoutExpiresAt({ MessageCollection }) {
  const messages = await channels.getOutgoingWithoutExpiresAt();
  return new MessageCollection(messages);
}

async function getNextExpiringMessage({ MessageCollection }) {
  const messages = await channels.getNextExpiringMessage();
  return new MessageCollection(messages);
}

// Unprocessed

async function getUnprocessedCount() {
  return channels.getUnprocessedCount();
}

async function getAllUnprocessed() {
  return channels.getAllUnprocessed();
}

async function getUnprocessedById(id) {
  return channels.getUnprocessedById(id);
}

async function saveUnprocessed(data, { forceSave } = {}) {
  const id = await channels.saveUnprocessed(_cleanData(data), { forceSave });
  return id;
}

async function saveUnprocesseds(arrayOfUnprocessed, { forceSave } = {}) {
  await channels.saveUnprocesseds(_cleanData(arrayOfUnprocessed), {
    forceSave,
  });
}

async function deduplicateUnprocessed() {
  await channels.deduplicateUnprocessed();
}

async function getUnprocessedDuplicatedCount() {
  return await channels.getUnprocessedDuplicatedCount();
}

// async function updateUnprocessedAttempts(id, attempts) {
//   await channels.updateUnprocessedAttempts(id, attempts);
// }
// async function updateUnprocessedWithData(id, data) {
//   await channels.updateUnprocessedWithData(id, data);
// }

async function updateUnprocessedsWithData(arrayOfUnprocessed) {
  await channels.updateUnprocessedsWithData(arrayOfUnprocessed);
}

// async function updateUnprocessedRequiredProtocolVersion(id, requiredProtocolVersion) {
//   await channels.updateUnprocessedRequiredProtocolVersion(id, requiredProtocolVersion);
// }

async function removeUnprocessed(idOrIds) {
  await channels.removeUnprocessed(idOrIds);
}

async function removeAllUnprocessed() {
  await channels.removeAllUnprocessed();
}

// Attachment downloads

async function getNextAttachmentDownloadJobs(limit) {
  return channels.getNextAttachmentDownloadJobs(limit);
}
async function saveAttachmentDownloadJob(job) {
  await channels.saveAttachmentDownloadJob(job);
}
async function setAttachmentDownloadJobPending(id, pending) {
  await channels.setAttachmentDownloadJobPending(id, pending);
}
async function resetAttachmentDownloadPending() {
  await channels.resetAttachmentDownloadPending();
}
async function removeAttachmentDownloadJob(id) {
  await channels.removeAttachmentDownloadJob(id);
}
async function removeAllAttachmentDownloadJobs() {
  await channels.removeAllAttachmentDownloadJobs();
}

// Other

async function removeAll() {
  await channels.removeAll();
  await accRemoveAll();
}

async function removeAllConfiguration() {
  await channels.removeAllConfiguration();
  await accRemoveAllConfiguration();
}

async function accRemoveAll() {
  await channels.accRemoveAll();
}

async function accRemoveAllConfiguration() {
  await channels.accRemoveAllConfiguration();
}

async function cleanupOrphanedAttachments() {
  await callChannel(CLEANUP_ORPHANED_ATTACHMENTS_KEY);
}

// Note: will need to restart the app after calling this, to set up afresh
async function removeOtherData() {
  await Promise.all([
    callChannel(ERASE_SQL_KEY),
    callChannel(ERASE_ATTACHMENTS_KEY),
  ]);
}

async function callChannel(name) {
  return new Promise((resolve, reject) => {
    ipcRenderer.send(name);
    ipcRenderer.once(`${name}-done`, (event, error) => {
      if (error) {
        return reject(error);
      }

      return resolve();
    });

    setTimeout(
      () => reject(new Error(`callChannel call to ${name} timed out`)),
      DATABASE_UPDATE_TIMEOUT
    );
  });
}

// Functions below here return plain JSON instead of Backbone Models

async function getMessagesNeedingUpgrade(
  limit,
  { maxVersion = MessageType.CURRENT_SCHEMA_VERSION }
) {
  const messages = await channels.getMessagesNeedingUpgrade(limit, {
    maxVersion,
  });

  return messages;
}

async function getMessagesWithVisualMediaAttachments(
  conversationId,
  { limit, pin }
) {
  return channels.getMessagesWithVisualMediaAttachments(conversationId, {
    limit,
    pin,
  });
}

async function getMessagesWithFileAttachments(conversationId, { limit }) {
  return channels.getMessagesWithFileAttachments(conversationId, {
    limit,
  });
}

// light task
async function createOrUpdateLightTask(data) {
  return channels.createOrUpdateLightTask(data);
}

async function setTaskFirstCardMessage(taskId, message) {
  return channels.setTaskFirstCardMessage(taskId, message);
}

async function linkTaskConversation(taskId, conversationId) {
  return channels.linkTaskConversation(taskId, conversationId);
}

function parseTaskMessage(task) {
  if (task && task.message) {
    try {
      return {
        ...task,
        message: JSON.parse(task.message),
      };
    } catch (error) {
      log.error('Light task message is not valid json:', row.message);
    }
  }

  return task;
}

async function getLightTask(taskId) {
  return parseTaskMessage(await channels.getLightTask(taskId));
}

async function deleteLocalTask(taskId) {
  return channels.deleteLocalTask(taskId);
}

async function deleteLightTask(data) {
  return channels.deleteLightTask(data);
}

async function getTaskRoles(taskId, role) {
  return channels.getTaskRoles(taskId, role);
}

async function getAllTasks() {
  const rows = await channels.getAllTasks();
  if (rows instanceof Array) {
    return rows.map(parseTaskMessage);
  }
  return rows;
}

async function linkTaskMessage(taskId, messageId) {
  return channels.linkTaskMessage(taskId, messageId);
}

async function getLinkedMessages(taskId) {
  return channels.getLinkedMessages(taskId);
}

async function delLinkedMessages(taskId) {
  return channels.delLinkedMessages(taskId);
}

async function updateTaskReadAtVersion(taskId, readAtTime, readAtVersion) {
  return channels.updateTaskReadAtVersion(taskId, readAtTime, readAtVersion);
}

async function getLightTaskExt(taskId) {
  return channels.getLightTaskExt(taskId);
}

async function setLightTaskExt(taskId, ext) {
  return channels.setLightTaskExt(taskId, ext);
}

async function createOrUpdateBasicVote(data) {
  return channels.createOrUpdateBasicVote(data);
}

async function createOrUpdateChangeableVote(data) {
  return channels.createOrUpdateChangeableVote(data);
}

async function getVote(voteId) {
  return channels.getVote(voteId);
}

async function deleteVote(voteId) {
  return channels.deleteVote(voteId);
}

async function voteLinkMessage(voteId, messageId) {
  return channels.voteLinkMessage(voteId, messageId);
}

async function getVoteLinkedMessages(voteId) {
  return channels.getVoteLinkedMessages(voteId);
}

async function delVoteLinkedMessages(voteId) {
  return channels.delVoteLinkedMessages(voteId);
}

async function getThreadMessagesUnreplied(
  conversationId,
  threadId,
  { MessageCollection, serverTimestamp = Number.MAX_VALUE, limit = 50 }
) {
  const messages = await channels.getThreadMessagesUnreplied(
    conversationId,
    threadId,
    serverTimestamp,
    limit
  );
  return new MessageCollection(messages);
}

async function findNewerThreadReplied(
  conversationId,
  threadId,
  { MessageCollection, serverTimestamp = Number.MAX_VALUE }
) {
  const messages = await channels.findNewerThreadReplied(
    conversationId,
    threadId,
    serverTimestamp
  );
  return new MessageCollection(messages);
}

async function deletePinMessagesByConversationId(conversationId) {
  await channels.deletePinMessagesByConversationId(conversationId);
}

async function getPinMessagesByConversationId(conversationId) {
  return await channels.getPinMessagesByConversationId(conversationId);
}

async function getPinMessageById(id) {
  return await channels.getPinMessageById(id);
}

async function saveReadPosition(readPosition) {
  return await channels.saveReadPosition(readPosition);
}

async function saveReadPositions(readPositions) {
  return await channels.saveReadPositions(readPositions);
}

async function topReadPosition(conversationId) {
  return await channels.topReadPosition(conversationId);
}

async function getReadPositions(
  conversationId,
  {
    begin = 0,
    end = Number.MAX_VALUE,
    includeBegin = false,
    includeEnd = false,
    limit = 50,
  }
) {
  return await channels.getReadPositions(conversationId, {
    begin,
    end,
    includeBegin,
    includeEnd,
    limit,
  });
}

async function getUnreadMessages(
  conversationId,
  { start = 0, end, limit, MessageCollection }
) {
  const messages = await channels.getUnreadMessages(
    conversationId,
    start,
    end,
    limit
  );
  return new MessageCollection(messages);
}

async function getUnreadMessageCount(
  conversationId,
  start = 0,
  end = Number.MAX_VALUE
) {
  return await channels.getUnreadMessageCount(conversationId, start, end);
}

async function findLastReadMessage(conversationId, { Message }) {
  const message = await channels.findLastReadMessage(conversationId);

  if (!message) {
    return null;
  }

  return new Message(message);
}

async function findLastMessageForMarkRead(
  conversationId,
  { Message, serverTimestamp = Number.MAX_VALUE }
) {
  const messages = await channels.findLastMessageForMarkRead(
    conversationId,
    serverTimestamp
  );

  return messages.map(message => {
    if (message) {
      return new Message(message);
    } else {
      return message;
    }
  });
}

async function findLastUserMessage(conversationId, { Message }) {
  const message = await channels.findLastUserMessage(conversationId);
  if (!message) {
    return null;
  }

  return new Message(message);
}

// mentions
async function getMentionsYouMessage(
  conversationId,
  { Message, serverTimestamp = Number.MAX_VALUE, limit = 50 }
) {
  const messages = await channels.getMentionsYouMessage(
    conversationId,
    serverTimestamp,
    limit
  );

  return messages.map(message => {
    if (message) {
      return new Message(message);
    } else {
      return message;
    }
  });
}

async function getMentionsYouMessageCount(
  conversationId,
  startTimestamp,
  endTimestamp = Number.MAX_VALUE
) {
  return await channels.getMentionsYouMessageCount(
    conversationId,
    startTimestamp,
    endTimestamp
  );
}

async function getMentionsAtYouMessage(
  conversationId,
  { Message, serverTimestamp = 0, limit = 50 }
) {
  const messages = await channels.getMentionsAtYouMessage(
    conversationId,
    serverTimestamp,
    limit
  );

  return messages.map(message => {
    if (message) {
      return new Message(message);
    } else {
      return message;
    }
  });
}

async function getMentionsAtAllMessage(
  conversationId,
  { Message, serverTimestamp = 0, limit = 50 }
) {
  const messages = await channels.getMentionsAtAllMessage(
    conversationId,
    serverTimestamp,
    limit
  );

  return messages.map(message => {
    if (message) {
      return new Message(message);
    } else {
      return message;
    }
  });
}

async function rebuildMessagesIndexesIfNotExists() {
  return await channels.rebuildMessagesIndexesIfNotExists();
}

async function rebuildMessagesTriggersIfNotExists() {
  return await channels.rebuildMessagesTriggersIfNotExists();
}

// return [{number, lastActive}]
async function getGroupMemberLastActiveList(conversationId) {
  return await channels.getGroupMemberLastActiveList(conversationId);
}

async function listThreadsWithNewestMessage(
  conversationId,
  { MessageCollection }
) {
  const messages = await channels.listThreadsWithNewestMessage(conversationId);
  return new MessageCollection(messages);
}

async function getUnhandledRecalls({ Message }) {
  const messages = await channels.getUnhandledRecalls();
  return messages.filter(m => m).map(m => new Message(m));
}

async function getNextMessagesToCorrectTimer(ourNumber, { Message, limit }) {
  const messages = await channels.getNextMessagesToCorrectTimer(
    ourNumber,
    limit
  );
  return messages.filter(m => m).map(m => new Message(m));
}

// file risk
async function saveFileRiskInfo({ sha256, fileSize, riskStatus }) {
  return await channels.saveFileRiskInfo({ sha256, fileSize, riskStatus });
}

async function getFileRiskInfo(sha256, fileSize) {
  return await channels.getFileRiskInfo(sha256, fileSize);
}

// url risk
async function saveUrlRiskInfo({ url, riskStatus }) {
  return await channels.saveUrlRiskInfo({ url, riskStatus });
}

async function getUrlRiskInfo(url) {
  return await channels.getUrlRiskInfo(url);
}
