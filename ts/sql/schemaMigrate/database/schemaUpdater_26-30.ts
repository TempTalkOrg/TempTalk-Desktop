import { Database } from '@signalapp/better-sqlite3';
import { LoggerType } from '../../../logger/types';

export function updateToSchemaVersion26(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 26) {
    return;
  }

  logger.info('updateToSchemaVersion26: starting...');

  db.transaction(() => {
    db.exec(
      `
      -- getUnreadMessages
      DROP INDEX IF EXISTS messages_conversation;
      CREATE INDEX
        messages_conversation ON messages (
          conversationId,
          serverTimestamp ASC
        )
      WHERE pin IS NULL;

      -- -- deletePinMessagesByConversationId
      -- -- getPinMessagesByConversationId
      -- DROP INDEX IF EXISTS messages_conversation_pin;
      -- CREATE INDEX
      --   messages_conversation_pin ON messages (conversationId, pin)
      -- WHERE pin IS NOT NULL;

      -- getMessagesWithVisualMediaAttachments
      DROP INDEX IF EXISTS messages_hasVisualMediaAttachments;
      CREATE INDEX
        messages_hasVisualMediaAttachments ON messages (
          conversationId,
          serverTimestamp DESC
        )
      WHERE
        pin IS NULL
        AND hasVisualMediaAttachments = 1
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE;

      -- getMessagesWithVisualMediaAttachments in pin
      DROP INDEX IF EXISTS messages_hasVisualMediaAttachments_pin;
      CREATE INDEX
        messages_hasVisualMediaAttachments_pin ON messages (
          conversationId,
          serverTimestamp DESC
        )
      WHERE
        pin IS NOT NULL
        AND hasVisualMediaAttachments = 1
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE;

      -- getMessagesWithFileAttachments
      DROP INDEX IF EXISTS messages_hasFileAttachments;
      CREATE INDEX
        messages_hasFileAttachments ON messages (
          conversationId,
          serverTimestamp DESC
        )
      WHERE
        pin IS NULL
        AND hasFileAttachments = 1
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE;

      -- findNewerThreadReplied
      DROP INDEX IF EXISTS messages_thread_replied;
      CREATE INDEX
        messages_thread_replied ON messages (
          conversationId,
          json_extract(json, '$.threadId'),
          serverTimestamp DESC
        )
      WHERE
        pin IS NULL
        AND json_extract(json, '$.threadId') IS NOT NULL
        AND (
          json_extract(json, '$.threadReplied') IS TRUE
          OR json_extract(json, '$.botContext') IS NULL
        );

      -- getThreadMessagesUnreplied
      DROP INDEX IF EXISTS messages_thread_unreplied;
      CREATE INDEX
        messages_thread_unreplied ON messages (
          conversationId,
          json_extract(json, '$.threadId'),
          serverTimestamp DESC
        )
      WHERE
        pin IS NULL
        AND json_extract(json, '$.threadId') IS NOT NULL
        AND json_extract(json, '$.threadReplied') IS NOT TRUE;

      -- getMessagesByConversation
      DROP INDEX IF EXISTS messages_conversation_visible;
      CREATE INDEX
        messages_conversation_visible ON messages (
          conversationId,
          serverTimestamp DESC
        )
      WHERE
        pin IS NULL
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
        AND json_extract(json, '$.flags') IS NOT 2
        AND (
          type IS NULL
          OR type NOT IN (
            'keychange',
            'verified-change'
          )
        );

      -- getMessagesByConversation
      DROP INDEX IF EXISTS messages_conversation_visible_unread;
      CREATE INDEX
        messages_conversation_visible_unread ON messages (
          conversationId,
          serverTimestamp DESC
        )
      WHERE
        pin IS NULL
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
        AND json_extract(json, '$.flags') IS NOT 2
        AND (
          type IS NULL
          OR type NOT IN (
            'keychange',
            'verified-change'
          )
        )
        AND unread = 1;

      -- getMessagesByConversation
      DROP INDEX IF EXISTS messages_conversation_thread_visible;
      CREATE INDEX
        messages_conversation_thread_visible ON messages (
          conversationId,
          json_extract(json, '$.threadId'),
          serverTimestamp DESC
        )
      WHERE
        pin IS NULL
        AND json_extract(json, '$.threadId') IS NOT NULL
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
        AND json_extract(json, '$.flags') IS NOT 2
        AND (
          type IS NULL
          OR type NOT IN (
            'keychange',
            'verified-change'
          )
        );

      -- getMessagesByConversation
      DROP INDEX IF EXISTS messages_conversation_thread_visible_unread;
      CREATE INDEX
        messages_conversation_thread_visible_unread ON messages (
          conversationId,
          json_extract(json, '$.threadId'),
          serverTimestamp DESC
        )
      WHERE
        pin IS NULL
        AND json_extract(json, '$.threadId') IS NOT NULL
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
        AND json_extract(json, '$.flags') IS NOT 2
        AND (
          type IS NULL
          OR type NOT IN (
            'keychange',
            'verified-change'
          )
        )
        AND unread = 1;

      -- getMessageBySender
      DROP INDEX IF EXISTS messages_duplicate_check;
      CREATE INDEX
        messages_duplicate_check ON messages (
          source,
          sourceDevice,
          sent_at
        )
      WHERE pin IS NULL;

      -- -- getOutgoingWithoutExpiresAt
      -- DROP INDEX IF EXISTS messages_without_timer;
      -- CREATE INDEX
      --   messages_without_timer ON messages (type, expireTimer)
      -- WHERE
      --   pin IS NULL
      --   AND expires_at IS NULL
      --   AND expireTimer IS NOT NULL;

      -- -- getExpiredMessagesCount
      -- -- getExpiredMessages
      -- -- getNextExpiringMessage
      -- -- select expired messages into messages
      -- -- 包含 > 和 IS NULL 两种情况
      -- DROP INDEX IF EXISTS messages_expires_at;
      -- CREATE INDEX
      --   messages_expires_at ON messages (expires_at ASC)
      -- WHERE pin IS NULL;

      -- getPinMessageById
      -- select normal messages into table messages
      DROP INDEX IF EXISTS messages_pin;
      CREATE index
        messages_pin ON messages (
          pin
        )
      WHERE pin IS NOT NULL;

      -- getMessagesBySentAt
      DROP INDEX IF EXISTS messages_receipt;
      CREATE INDEX
        messages_receipt ON messages (
          sent_at,
          serverTimestamp DESC
        )
      WHERE
        pin IS NULL
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE;

      -- getQuoteMessages
      DROP INDEX IF EXISTS message_quote_without_thread;
      CREATE INDEX
        message_quote_without_thread ON messages (
          serverTimestamp DESC
        )
      WHERE
        pin IS NULL
        AND json_extract(json, '$.quote') IS NOT NULL
        AND json_extract(json, '$.threadContext') IS NULL;

      -- -- getMessagesNeedingUpgrade
      -- DROP INDEX IF EXISTS messages_schemaVersion;
      -- CREATE INDEX messages_schemaVersion ON messages (schemaVersion);

      -- findLastReadMessage
      DROP INDEX IF EXISTS messages_conversation_has_read;
      CREATE INDEX
        messages_conversation_has_read ON messages (
          conversationId,
          serverTimestamp DESC
        )
      WHERE
        pin IS NULL
        AND unread IS NULL;

      -- getUnreadMessageCount
      DROP INDEX IF EXISTS messages_conversation_unread_count;
      CREATE INDEX
        messages_conversation_unread_count ON messages (
          conversationId,
          type,
          serverTimestamp DESC
        )
      WHERE
        pin IS NULL
        AND json_extract(json, '$.recall') IS NULL
        AND json_extract(json, '$.hasBeenRecalled') IS NOT TRUE;

      -- findLastMessageForMarkRead
      DROP INDEX IF EXISTS messages_conversation_non_outgoing;
      CREATE INDEX
        messages_conversation_non_outgoing ON messages (
          conversationId,
          serverTimestamp DESC
        )
      WHERE
        pin IS NULL
        AND type IS NOT 'outgoing';

      -- searchConversations
      DROP INDEX IF EXISTS conversations_names;
      CREATE INDEX
        conversations_names ON conversations (
          name,
          active_at DESC
        )
      WHERE
        active_at IS NOT NULL
        OR json_extract(json, '$.directoryUser') IS TRUE
        OR (
          type = 'group'
          AND json_extract(json, '$.left') IS NOT TRUE
          AND json_extract(json, '$.disbanded') IS NOT TRUE
        );

      -- getReadPositions
      -- topReadPosition
      DROP INDEX IF EXISTS read_position_conversation;
      CREATE INDEX
        read_position_conversation ON read_positions (
          conversationId,
          maxServerTimestamp ASC
        );
      `
    );

    db.pragma('user_version = 26');
  })();

  logger.info('updateToSchemaVersion26: success!');
}

export function updateToSchemaVersion27(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 27) {
    return;
  }

  logger.info('updateToSchemaVersion27: starting...');

  db.transaction(() => {
    db.exec(
      `
      DROP INDEX IF EXISTS messages_mentions_at_you;
      DROP INDEX IF EXISTS messages_mentions_at_all;
      DROP INDEX IF EXISTS messages_mentions_quote_you;
      DROP INDEX IF EXISTS messages_mentions_you;

      CREATE INDEX messages_mentions_you
      ON messages (
        conversationId,
        type,
        serverTimestamp
      )
      WHERE
        json_extract(json, '$.hasBeenRecalled') IS NOT TRUE
        AND json_extract(json, '$.recall') IS NULL
        AND pin IS NULL
        AND (
          json_extract(json, '$.mentionsQuoteFlags') & 0x1
          OR json_extract(json, '$.mentionsAtFlags') & 0x1
          OR json_extract(json, '$.mentionsAtFlags') & 0x2
        );
      `
    );

    db.pragma('user_version = 27');
  })();

  logger.info('updateToSchemaVersion27: success!');
}

export function updateToSchemaVersion28(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 28) {
    return;
  }

  logger.info('updateToSchemaVersion28: starting...');

  db.transaction(() => {
    db.exec(
      `
      ALTER TABLE read_positions
        ADD COLUMN maxNotifySequenceId INTEGER;
      `
    );

    db.pragma('user_version = 28');
  })();

  logger.info('updateToSchemaVersion28: success!');
}

export function updateToSchemaVersion29(
  currentVersion: number,
  db: Database,
  logger: LoggerType
) {
  if (currentVersion >= 29) {
    return;
  }

  logger.info('updateToSchemaVersion29: starting...');

  // -- getGroupMemberLastActiveList
  db.transaction(() => {
    db.exec(
      `
      DROP INDEX IF EXISTS messages_conversation_source;
      CREATE INDEX
      messages_conversation_source ON messages (
        conversationId,
        source,
        type,
        serverTimestamp ASC
      )
      WHERE pin IS NULL;
      `
    );

    db.pragma('user_version = 29');
  })();

  logger.info('updateToSchemaVersion29: success!');
}

export function updateToSchemaVersion30(
  currentVersion: number,
  db: Database,
  logger: LoggerType
) {
  if (currentVersion >= 30) {
    return;
  }

  logger.info('updateToSchemaVersion30: starting...');

  // -- getUnhandledRecalls
  db.transaction(() => {
    db.exec(
      `
      DROP INDEX IF EXISTS messages_recall_source;
      CREATE INDEX messages_recall_source
      ON messages (
        serverTimestamp ASC
      )
      WHERE
        json_type(json, '$.recall') = 'object'
        AND json_extract(json, '$.recall.target') IS NULL;
      `
    );

    db.pragma('user_version = 30');
  })();

  logger.info('updateToSchemaVersion30: success!');
}
