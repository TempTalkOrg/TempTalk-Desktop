/* global
  Whisper,
  Backbone,
  _,
  ConversationController,
  MessageController,
  window
*/

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};
  Whisper.ReadReceipts = new (Backbone.Collection.extend({
    readByAtUpdateBather: Signal.Util.createBatcher({
      name: 'readByAtUpdateBather',
      wait: 200,
      maxSize: Infinity,
      processBatch: async items => {
        const deduped = Array.from(new Set(items));

        log.info(
          'readByAtUpdateBather: deduped ',
          `${items.length} into ${deduped.length}`
        );

        for (const conversation of deduped) {
          await new Promise(r => setTimeout(r, 0));
          conversation.trigger('change:read_by_at');
        }
      },
    }),

    async getTargetMessage(reader, timestamp, readerGroups) {
      const messages = await window.Signal.Data.getMessagesBySentAt(timestamp, {
        MessageCollection: Whisper.MessageCollection,
      });

      let found;

      do {
        if (messages.length === 0) {
          break;
        }

        // find message in 1v1 conversation with reader
        found = messages.find(
          item => item.isOutgoing() && reader === item.get('conversationId')
        );
        if (found) {
          break;
        }

        let gids = readerGroups[reader];
        if (!gids) {
          try {
            const groups = await window.Signal.Data.getAllGroupsInvolvingId(
              reader,
              { ConversationCollection: Whisper.ConversationCollection }
            );

            const ids = groups.pluck('id');
            gids = ids || [];
            readerGroups[reader] = gids;
          } catch (error) {
            window.log.error(
              'getAllGroupsInvolvingId failed',
              JSON.stringify(error)
            );
          }
        }

        if (!gids?.length) {
          break;
        }

        found = messages.find(
          item =>
            item.isOutgoing() && _.contains(gids, item.get('conversationId'))
        );
      } while (false);

      if (found) {
        messages.remove(found);
        found = MessageController.register(found.id, found);
      }

      return found;
    },

    async findTargetMessage(receipt, readerGroups) {
      try {
        const reader = receipt.get('reader');
        const timestamp = receipt.get('timestamp');

        const message = await this.getTargetMessage(
          reader,
          timestamp,
          readerGroups
        );

        if (!message) {
          window.log.info('No message for read receipt', reader, timestamp);
          return;
        }

        return message;
      } catch (error) {
        window.log.error(
          'ReadReceipts.findTargetMessage error:',
          error && error.stack ? error.stack : error
        );
      }
    },

    updateConversationReads(
      conversationReads,
      conversationId,
      readAt,
      maxServerTimestamp,
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
          maxServerTimestamp,
          readAt,
          maxNotifySequenceId,
        };
      }
    },

    async forMessage(message) {
      if (!message) {
        return;
      }

      if (message.isOutgoing()) {
        // outgoing find receipts by messsage
        const receipts = this.where({ timestamp: message.get('sent_at') });
        if (!receipts?.length) {
          return;
        }

        window.log.info('found unhandled old style receipts:', receipts);

        const position = {
          conversationId: message.get('conversationId'),
          maxServerTimestamp: message.getServerTimestamp(),
          maxNotifySequenceId: message.get('notifySequenceId'),
        };

        // group and handle receipts by reader
        const groups = _.groupBy(receipts, receipt => receipt.get('reader'));
        for (const reader of Object.keys(groups)) {
          const group = groups[reader];
          const minReadAt = Math.min(group.map(r => r.get('envelopedAt')));

          const readPosition = {
            ...position,
            reader,
            readAt: minReadAt,
          };

          await this.onReceipt(null, readPosition);
        }

        this.remove(receipts);
      } else {
        // construct read position by received message
        // if received someone's message, then someone
        // must has read at here
        const readPosition = {
          reader: message.getSource(),
          conversationId: message.get('conversationId'),
          readAt: message.getServerTimestamp(),
          maxServerTimestamp: message.getServerTimestamp(),
          maxNotifySequenceId: message.get('notifySequenceId'),
        };

        await this.onReceipt(null, readPosition);
      }
    },

    async onNormalReceipts(receipts, readPosition) {
      const readerMapping = {};

      // read receipt from others,
      // we just keep one last read position for everyone in each conversation
      // we save these readerByPositions in conversations

      if (readPosition) {
        const {
          reader,
          conversationId,
          readAt,
          maxServerTimestamp,
          maxNotifySequenceId,
        } = readPosition;

        const conversationReads = {};
        conversationReads[conversationId] = {
          readAt,
          maxServerTimestamp,
          maxNotifySequenceId,
        };
        readerMapping[reader] = conversationReads;
      } else {
        // compitable for receipts from older version client
        // manually generate readPosition for each reader of each conversation
        const readerInGroups = {};

        // receipt
        // {
        //   timestamp, // message's sent_at
        //   reader, // receipt sent by who
        //   envelopedAt, // envelope.timestamp, receipt message self's sent_at
        //   deviceId, //reader's deviceId
        // }
        for (const receipt of receipts) {
          const { reader, envelopedAt: readAt } = receipt;

          const conversationReads = readerMapping[reader] || {};
          if (!readerMapping[reader]) {
            readerMapping[reader] = conversationReads;
          }

          const receiptModel = new Backbone.Model(receipt);
          this.add(receiptModel);
          const target = await this.findTargetMessage(
            receiptModel,
            readerInGroups
          );
          if (!target) {
            continue;
          }

          if (target.isNoNeedReceipts()) {
            this.remove(receiptModel);
            return;
          }

          const conversationId = target.get('conversationId');
          if (!conversationId) {
            continue;
          }

          const serverTimestamp = target.getServerTimestamp();
          if (!serverTimestamp) {
            continue;
          }

          this.remove(receiptModel);

          const notifySequenceId = target.get('notifySequenceId');

          // merge conversation reads by conversation and reader
          this.updateConversationReads(
            conversationReads,
            conversationId,
            readAt,
            serverTimestamp,
            notifySequenceId
          );
        }
      }

      // update read position in conversation
      for (const reader of Object.keys(readerMapping)) {
        const conversationReads = readerMapping[reader];
        for (const conversationId of Object.keys(conversationReads)) {
          const conversation = ConversationController.get(conversationId);
          if (conversation) {
            // update readerByPosition
            const readByAtMapping = conversation.get('read_by_at') || {};
            const oldPosition = readByAtMapping[reader];

            const newPosition = conversationReads[conversationId];
            if (
              !oldPosition?.maxServerTimestamp ||
              newPosition.maxServerTimestamp > oldPosition.maxServerTimestamp
            ) {
              window.log.info(
                'new postion',
                newPosition,
                'replace exists position',
                oldPosition,
                'for reader',
                reader,
                'in',
                conversationId
              );

              readByAtMapping[reader] = newPosition;
              conversation.set(
                { read_by_at: { ...readByAtMapping } },
                { silent: true }
              );
              this.readByAtUpdateBather.add(conversation);

              // save
              await window.Signal.Data.updateConversation(
                conversation.attributes
              );
            } else {
              window.log.info(
                'skip position',
                newPosition,
                'current position:',
                oldPosition,
                'for reader',
                reader,
                'in',
                conversationId
              );
            }
          } else {
            window.log.warn(
              'conversation not found for',
              reader,
              'in',
              conversationId
            );
          }
        }
      }
    },

    async onConfidentialReceipts(receipts) {
      const readerInGroups = {};

      // find and update message status
      for (const receipt of receipts) {
        const receiptModel = new Backbone.Model(receipt);
        this.add(receiptModel);
        const target = await this.findTargetMessage(
          receiptModel,
          readerInGroups
        );
        if (!target) {
          log.warn('not found message for', receipt);
          continue;
        }

        // skip non confidential message
        if (!target.isConfidentialMessage()) {
          this.remove(receiptModel);
          continue;
        }

        // update message confidential-read records
        // and if all read, then remove this message
        await target.updateCondidentialStatus(receipt.reader);
        this.remove(receiptModel);
      }
    },

    async onReceipt(receipt, readPosition, confirm) {
      const receipts = [];

      if (Array.isArray(receipt)) {
        receipts.push(...receipt.filter(Boolean));
      } else if (receipt) {
        receipts.push(receipt);
      } else {
        // invalid receipt
      }

      const isConfidential = receipts.some(
        receipt => receipt.messageMode === textsecure.protobuf.Mode.CONFIDENTIAL
      );

      if (isConfidential) {
        await this.onConfidentialReceipts(receipts);
      } else {
        await this.onNormalReceipts(receipts, readPosition);
      }

      if (typeof confirm === 'function') {
        confirm();
      }
    },
  }))();
})();
