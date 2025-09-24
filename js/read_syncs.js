/* global
  Backbone,
  Whisper,
  MessageController
*/

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};
  Whisper.ReadSyncs = {
    async findTargetMessage(receipt) {
      try {
        const messages = await window.Signal.Data.getMessagesBySentAt(
          receipt.get('timestamp'),
          {
            MessageCollection: Whisper.MessageCollection,
          }
        );

        if (!messages?.length) {
          return;
        }

        const found = messages.find(
          item =>
            item.isIncoming() && item.get('source') === receipt.get('sender')
        );

        if (!found) {
          return;
        }

        const notificationForMessage = found
          ? Whisper.Notifications.findWhere({ messageId: found.id })
          : null;
        const removedNotification = Whisper.Notifications.remove(
          notificationForMessage
        );
        const receiptSender = receipt.get('sender');
        const receiptTimestamp = receipt.get('timestamp');
        const wasMessageFound = Boolean(found);
        const wasNotificationFound = Boolean(notificationForMessage);
        const wasNotificationRemoved = Boolean(removedNotification);

        window.log.info('Receive read sync:', {
          receiptSender,
          receiptTimestamp,
          wasMessageFound,
          wasNotificationFound,
          wasNotificationRemoved,
        });

        const message = MessageController.register(found.id, found);

        return message;
      } catch (error) {
        window.log.error(
          'ReadSyncs.findTargetMessage error:',
          error && error.stack ? error.stack : error
        );
      }
    },

    updateConversationReads(
      conversationReads,
      conversationId,
      readAt,
      maxServerTimestamp,
      sourceDevice,
      maxNotifySequenceId
    ) {
      const { readAt: lastReadAt, maxServerTimestamp: lastServerTimestamp } =
        conversationReads[conversationId] || {};

      if (
        !lastServerTimestamp ||
        lastServerTimestamp < maxServerTimestamp ||
        (lastServerTimestamp === maxServerTimestamp && lastReadAt > readAt)
      ) {
        conversationReads[conversationId] = {
          sourceDevice,
          conversationId,
          maxServerTimestamp,
          readAt,
          maxNotifySequenceId,
        };
      }
    },

    async onNormalReceipts(receipts) {
      // we should keep every read position of mine in any conversation
      // read positions matter with unread count and messages expiration
      // {
      //   ${conversationId} : {
      //     sourceDevice,
      //     conversationId,
      //     maxServerTimestamp,
      //     readAt,
      //   }
      // }
      const conversationReads = {};

      const readPositions = receipts.map(r => r.readPosition).filter(r => r);
      if (!readPositions.length) {
        // compitable for synced read from older version client
        // keep maxServerTimestamp of each conversation, as read position of this time

        for (const syncedReceipt of receipts) {
          const receiptModel = new Backbone.Model(syncedReceipt);
          const target = await this.findTargetMessage(receiptModel);
          if (!target) {
            continue;
          }

          const conversationId = target.get('conversationId');
          if (!conversationId) {
            continue;
          }

          const serverTimestamp = target.getServerTimestamp();
          if (!serverTimestamp) {
            continue;
          }

          const notifySequenceId = target.get('notifySequenceId');

          // syncedReceipt envelope timestamp as readAt
          const { envelopedAt: readAt, sourceDevice } = syncedReceipt;

          this.updateConversationReads(
            conversationReads,
            conversationId,
            readAt,
            serverTimestamp,
            sourceDevice,
            notifySequenceId
          );
        }

        // save generated readPositions
        readPositions.push(...Object.values(conversationReads));
      }

      for (const position of readPositions) {
        const { conversationId } = position;

        const conversation = ConversationController.get(conversationId);
        if (conversation) {
          await conversation.onReadPosition(position);
        }
      }
    },

    async onConfidentialReceipts(receipts) {
      for (const receipt of receipts) {
        // find and handle
        const receiptModel = new Backbone.Model(receipt);
        const target = await this.findTargetMessage(receiptModel);
        if (!target) {
          continue;
        }

        if (!target.isConfidentialMessage()) {
          continue;
        }

        // handle confidential message
        // remove message
        window.Signal.Data._removeMessages([target.id]);

        target.getConversation()?.trigger('expired', target);
      }
    },

    /************
    receipt:
      {
        sender,
        timestamp,
        envelopedAt, // timestamp when receipt was received
        readPosition: {
          sender,
          groupId,
          readAt, // timestamp when receipt was generated on other devices
          maxReadSentAt,
        }
      }
    ************/
    async onReceipt(receipt, confirm) {
      const receipts = receipt instanceof Array ? receipt : [receipt];

      const confidentialReceipts = [];
      const normalReceipts = [];

      receipts.forEach(receipt => {
        if (!receipt) {
          return;
        }

        if (receipt.messageMode === textsecure.protobuf.Mode.CONFIDENTIAL) {
          confidentialReceipts.push(receipt);
        } else {
          normalReceipts.push(receipt);
        }
      });

      if (confidentialReceipts.length) {
        await this.onConfidentialReceipts(confidentialReceipts);
      }

      if (normalReceipts?.length) {
        await this.onNormalReceipts(normalReceipts);
      }

      if (typeof confirm === 'function') {
        confirm();
      }
    },
  };
})();
