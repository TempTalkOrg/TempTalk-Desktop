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
  Whisper.Recalls = new (Backbone.Collection.extend({
    async loadByDB() {
      const models = await window.Signal.Data.getUnhandledRecalls({
        Message: Whisper.Message,
      });

      for (const model of models) {
        const recall = model.get('recall');
        if (!recall) {
          continue;
        }

        const { realSource } = recall;
        if (!realSource) {
          window.log.warn(
            'recall skipped: incomplete message',
            recall,
            model.idForLogging()
          );
          continue;
        }

        if (model.getSource() !== realSource.source) {
          window.log.warn(
            'recall skipped: source does not match message',
            recall,
            model.idForLogging()
          );
          continue;
        }

        const conversation = model.getConversation();
        if (!conversation) {
          continue;
        }

        const recalledMessage = await model.loadMessageByRealSource(realSource);
        if (recalledMessage) {
          model.set({
            recall: {
              ...recall,
              target: {
                id: recalledMessage.get('id'),
                body: recalledMessage.get('body'),
                sent_at: recalledMessage.get('sent_at'),
                rapidFiles: recalledMessage.get('rapidFiles'),
                received_at: recalledMessage.get('received_at'),
                serverTimestamp: recalledMessage.getServerTimestamp(),
                sequenceId: recalledMessage.get('sequenceId'),
                notifySequenceId: recalledMessage.get('notifySequenceId'),
              },
            },
          });

          if (
            model.isIncoming() &&
            recalledMessage.isIncoming() &&
            !(await recalledMessage.isIncomingMessageRead())
          ) {
            // if recalledMessage is unread, unreadCount minus 1
            const unreadCount = conversation.get('unreadCount') - 1;
            if (unreadCount >= 0) {
              conversation.set({ unreadCount });
              await window.Signal.Data.updateConversation(
                conversation.attributes
              );
            }
          }

          recalledMessage.set({
            recalled: {
              byId: model.id,
            },
            hasBeenRecalled: true,
          });

          await window.Signal.Data.saveMessage(recalledMessage.attributes, {
            Message: Whisper.Message,
          });

          conversation.trigger('recalled', recalledMessage);
        } else {
          this.addRecall(model);
        }
      }
    },
    makeIdForRecall(realSource) {
      const { source, sourceDevice, timestamp } = realSource;
      return `${source}-${sourceDevice}-${timestamp}`;
    },
    addRecall(recallMessage) {
      const recall = recallMessage?.get('recall');
      if (!recall) {
        return null;
      }

      return this.add({
        id: this.makeIdForRecall(recall.realSource),
        recallMessage,
      });
    },
    forMessage(message) {
      const recallId = this.makeIdForRecall({
        source: message.getSource(),
        sourceDevice: message.getSourceDevice(),
        timestamp: message.get('sent_at'),
      });

      const model = this.get(recallId);
      if (!model) {
        return null;
      }

      // removed from cache
      this.remove(model);

      return model.get('recallMessage');
    },
  }))();
})();
