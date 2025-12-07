/* global Whisper, Signal, setTimeout, clearTimeout, MessageController */

const { isFunction, isNumber, omit } = require('lodash');
const { v4: getGuid } = require('uuid');
const {
  getMessageById,
  getNextAttachmentDownloadJobs,
  removeAttachmentDownloadJob,
  resetAttachmentDownloadPending,
  saveAttachmentDownloadJob,
  saveMessage,
  setAttachmentDownloadJobPending,
} = require('./data');
const { stringFromBytes } = require('./crypto');

module.exports = {
  start,
  stop,
  addJob,
};

const MAX_ATTACHMENT_JOB_PARALLELISM = 15;

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const TICK_INTERVAL = MINUTE;

const RETRY_BACKOFF = {
  1: 30 * SECOND,
  2: 30 * SECOND,
  3: 30 * SECOND,
};

let enabled = false;
let timeout;
let getMessageReceiver;
let logger;
const _activeAttachmentDownloadJobs = {};

async function start(options = {}) {
  ({ getMessageReceiver, logger } = options);
  if (!isFunction(getMessageReceiver)) {
    throw new Error(
      'attachment_downloads/start: getMessageReceiver must be a function'
    );
  }
  if (!logger) {
    throw new Error('attachment_downloads/start: logger must be provided!');
  }

  enabled = true;
  await resetAttachmentDownloadPending();

  _tick();
}

async function stop() {
  enabled = false;
  if (timeout) {
    clearTimeout(timeout);
    timeout = null;
  }
}

async function addJob(attachment, job = {}) {
  if (!attachment) {
    throw new Error('attachments_download/addJob: attachment is required');
  }

  const { messageId, type, index } = job;
  if (!messageId) {
    throw new Error('attachments_download/addJob: job.messageId is required');
  }
  if (!type) {
    throw new Error('attachments_download/addJob: job.type is required');
  }
  if (!isNumber(index)) {
    throw new Error('attachments_download/addJob: index must be a number');
  }

  const id = getGuid();
  const timestamp = Date.now();
  const toSave = {
    ...job,
    id,
    attachment,
    timestamp,
    pending: 0,
    attempts: 0,
  };

  logger.info('add download job', id, attachment.id, messageId);

  await saveAttachmentDownloadJob(toSave);

  _maybeStartJob();

  return {
    ...attachment,
    pending: true,
    downloadJobId: id,
  };
}

async function _tick() {
  if (timeout) {
    clearTimeout(timeout);
    timeout = null;
  }

  _maybeStartJob();
  timeout = setTimeout(_tick, TICK_INTERVAL);
}

async function _maybeStartJob() {
  if (!enabled) {
    return;
  }

  const jobCount = getActiveJobCount();
  const limit = MAX_ATTACHMENT_JOB_PARALLELISM - jobCount;
  if (limit <= 0) {
    return;
  }

  const nextJobs = await getNextAttachmentDownloadJobs(limit);
  if (nextJobs.length <= 0) {
    return;
  }

  // To prevent the race condition caused by two parallel database calls, eached kicked
  //   off because the jobCount wasn't at the max.
  const secondJobCount = getActiveJobCount();
  const needed = MAX_ATTACHMENT_JOB_PARALLELISM - secondJobCount;
  if (needed <= 0) {
    return;
  }

  const jobs = nextJobs.slice(0, Math.min(needed, nextJobs.length));
  for (let i = 0, max = jobs.length; i < max; i += 1) {
    const job = jobs[i];
    const existing = _activeAttachmentDownloadJobs[job.id];
    if (existing) {
      logger.warn(`_maybeStartJob: Job ${job.id} is already running`);
    } else {
      _activeAttachmentDownloadJobs[job.id] = _runJob(job);
    }
  }
}

async function _runJob(job) {
  const { id, messageId, attachment, type, index, attempts, forwardUuid } =
    job || {};

  let message;

  try {
    logger.info('run download job', id, attachment.id, messageId);

    if (!job || !attachment || !messageId) {
      throw new Error(
        `_runJob: Key information required for job was missing. Job id: ${id}`
      );
    }

    message = MessageController.getById(messageId);
    if (!message) {
      message = await getMessageById(messageId, { Message: Whisper.Message });
      if (!message) {
        logger.error('_runJob: Source message not found, deleting job');
        await _finishJob(null, id, forwardUuid);
        return;
      }

      message = MessageController.register(message.id, message);
    }

    // if attachment already has path
    if (attachment.path) {
      await _addAttachmentToMessage(
        message,
        {
          ...attachment,
          pending: 0,
        },
        { type, index },
        forwardUuid
      );

      await _finishJob(message, id, forwardUuid);
      return;
    }

    // digest and key maybe deleted when attachments were tagged as permanent deleted before.
    // just reset error and pending flags.
    if (!attachment.digest || !attachment.key) {
      logger.error(
        `_runJob: digest and key for job was missing. Job id: ${id}, delete job.`
      );
      await _addAttachmentToMessage(
        message,
        {
          ...attachment,
          error: true,
          pending: 0,
          fetchError: true,
        },
        { type, index },
        forwardUuid
      );
      await _finishJob(message, id, forwardUuid);
      return;
    }

    const pending = 1;
    await setAttachmentDownloadJobPending(id, pending);

    const messageReceiver = getMessageReceiver();
    if (!messageReceiver) {
      throw new Error('_runJob: messageReceiver not found');
    }

    const downloaded = await messageReceiver.downloadAttachment(attachment);

    const upgradedAttachment =
      await Signal.Migrations.processNewAttachment(downloaded);

    log.info(
      'download file on disk as:',
      upgradedAttachment.path,
      ',for:',
      upgradedAttachment.id
    );

    delete upgradedAttachment.error;
    delete upgradedAttachment.pending;
    delete upgradedAttachment.fetchError;
    await _addAttachmentToMessage(
      message,
      upgradedAttachment,
      { type, index },
      forwardUuid
    );

    await _finishJob(message, id, forwardUuid);
  } catch (error) {
    const currentAttempt = (attempts || 0) + 1;

    if (currentAttempt >= 1) {
      logger.error(
        `_runJob: ${currentAttempt} failed attempts, marking attachment ${id}
        from message ${message.idForLogging()} as error:`,
        error && error.stack ? error.stack : error
      );

      try {
        await _addAttachmentToMessage(
          message,
          _markAttachmentAsError(attachment, error),
          { type, index },
          forwardUuid
        );
      } catch (error) {
        logger.error(
          'failed to download attachment, and cannot update message:',
          error
        );
      }

      await _finishJob(message, id, forwardUuid);

      return;
    }

    logger.error(
      `_runJob: Failed to download attachment type ${type} for message ${message.idForLogging()}, attempt ${currentAttempt}:`,
      error && error.stack ? error.stack : error
    );

    const failedJob = {
      ...job,
      pending: 0,
      attempts: currentAttempt,
      timestamp: Date.now() + RETRY_BACKOFF[currentAttempt],
    };

    await saveAttachmentDownloadJob(failedJob);
    delete _activeAttachmentDownloadJobs[id];
    _maybeStartJob();
  }
}

async function _finishJob(message, id, forwardUuid) {
  logger.info('finish download job', id, forwardUuid, message?.idForLogging());

  if (message) {
    await saveMessage(message.attributes, { Message: Whisper.Message });

    const conversation = message.getConversation();
    if (conversation) {
      const fromConversation = conversation.messageCollection.get(message.id);

      if (fromConversation && message !== fromConversation) {
        fromConversation.set(message.attributes);
        fromConversation.trigger('change', fromConversation);
      }
    }

    // always trigger change for message.
    message.trigger('change', message);

    if (forwardUuid) {
      message.trigger(`update_forward:${forwardUuid}`);
    }
  }

  await removeAttachmentDownloadJob(id);
  delete _activeAttachmentDownloadJobs[id];
  _maybeStartJob();
}

function getActiveJobCount() {
  return Object.keys(_activeAttachmentDownloadJobs).length;
}

function _markAttachmentAsError(attachment, error) {
  const errorStatus = error.response?.status;

  return {
    ...attachment,
    error: errorStatus,
    fetchError: !errorStatus,
    pending: 0,
  };
}

async function _addAttachmentToMessage(
  message,
  attachment,
  { type, index },
  forwardUuid
) {
  if (!message) {
    return;
  }

  const logPrefix = `${message.idForLogging()} (type: ${type}, index: ${index})`;

  let forward;
  if (forwardUuid) {
    const found = message.findOurForwardByUuid(forwardUuid);
    if (!found) {
      logger.error(`forward ${forwardUuid} not found in message: ${logPrefix}`);
      return;
    }

    const singleForward = message.getIfSingleForward(found.forwards);
    forward = singleForward || found;
  }

  if (type === 'long-message') {
    try {
      const { data } = await Signal.Migrations.loadAttachmentData(attachment);

      if (forward) {
        forward.body = attachment.isError
          ? forward.body
          : stringFromBytes(data);
        forward.bodyPending = false;
      } else {
        message.set({
          body: attachment.isError
            ? message.get('body')
            : stringFromBytes(data),
          bodyPending: false,
        });
      }
    } catch (error) {
      // because long-message attachment was removed from message
      // here we re-saved it
      const attachments = forward
        ? forward.attachments
        : message.get('attachments');
      attachments.push(attachment);

      if (forward) {
        forward.attachments = attachments;
      } else {
        message.set({ attachments });
      }
    } finally {
      if (attachment.path) {
        Signal.Migrations.deleteAttachmentData(attachment.path);
        delete attachment.path;
      }
    }
    return;
  }

  if (type === 'attachment') {
    const attachments = forward
      ? forward.attachments
      : message.get('attachments');
    if (!attachments || attachments.length <= index) {
      throw new Error(
        `_addAttachmentToMessage: attachments didn't exist or ${index} was too large`
      );
    }
    _replaceAttachment(attachments, index, attachment, logPrefix);
    return;
  }

  if (type === 'contact') {
    const contacts = message.get('contacts');
    if (!contacts || contacts.length <= index) {
      throw new Error(
        `_addAttachmentToMessage: contacts didn't exist or ${index} was too large`
      );
    }
    const item = contacts[index];
    if (item && item.avatar && item.avatar.avatar) {
      _replaceAttachment(item.avatar, 'avatar', attachment, logPrefix);
    } else {
      logger.warn(
        `_addAttachmentToMessage: Couldn't update contacts with avatar attachment for message ${message.idForLogging()}`
      );
    }

    return;
  }

  if (type === 'quote') {
    const quote = message.get('quote');
    if (!quote) {
      throw new Error("_addAttachmentToMessage: quote didn't exist");
    }
    const { attachments } = quote;
    if (!attachments || attachments.length <= index) {
      throw new Error(
        `_addAttachmentToMessage: quote attachments didn't exist or ${index} was too large`
      );
    }

    const item = attachments[index];
    if (!item) {
      throw new Error(
        `_addAttachmentToMessage: attachment ${index} was falsey`
      );
    }
    _replaceAttachment(item, 'thumbnail', attachment, logPrefix);
    return;
  }

  if (type === 'group-avatar') {
    const group = message.get('group');
    if (!group) {
      throw new Error("_addAttachmentToMessage: group didn't exist");
    }

    const existingAvatar = group.avatar;
    if (existingAvatar && existingAvatar.path) {
      await Signal.Migrations.deleteAttachmentData(existingAvatar.path);
    }

    _replaceAttachment(group, 'avatar', attachment, logPrefix);
    return;
  }

  throw new Error(
    `_addAttachmentToMessage: Unknown job type ${type} for message ${message.idForLogging()}`
  );
}

function _replaceAttachment(object, key, newAttachment, logPrefix) {
  const oldAttachment = object[key];
  if (oldAttachment && oldAttachment.path) {
    logger.warn(
      `_replaceAttachment: ${logPrefix} - old attachment already had path, not replacing`
    );
    return;
  }

  // eslint-disable-next-line no-param-reassign
  object[key] = newAttachment;
}
