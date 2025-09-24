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
  Whisper.EmojiReactions = new (Backbone.Collection.extend({
    forMessage(message) {
      const emojiReaction = this.findWhere({
        source: message.getSource(),
        sourceDevice: message.getSourceDevice(),
        timestamp: message.get('sent_at'),
      });

      if (emojiReaction) {
        const whisperMessage = emojiReaction.get('whisperMessage');

        window.log.info(
          'Found early reaction message',
          whisperMessage?.idForLogging(),
          'for message',
          message.idForLogging()
        );

        const initialMessage = emojiReaction.get('initialMessage');
        if (!initialMessage) {
          window.log.error(
            'invalid initialMessage for reaction',
            whisperMessage?.idForLogging()
          );
          return null;
        }

        if (!whisperMessage) {
          window.log.error(
            'invalid whisperMessage for reaction source',
            initialMessage?.reaction?.source
          );
          return null;
        }

        this.remove(emojiReaction);

        const { emoji, remove, source } = initialMessage.reaction;

        return {
          emoji,
          remove,
          source,
          fromId: whisperMessage.getSource(),
          timestamp: whisperMessage.get('sent_at'),
        };
      }

      return null;
    },

    async onEmojiReaction(emojiReaction, confirm) {
      const initialMessage = emojiReaction?.get('initialMessage');
      const whisperMessage = emojiReaction?.get('whisperMessage');

      if (!initialMessage || !whisperMessage) {
        log.error(
          'invalid emoji reaction passed in',
          whisperMessage?.idForLogging(),
          initialMessage?.reaction?.source
        );
        return;
      }

      const { reaction } = initialMessage;

      log.info(
        'on emoji reaction message',
        whisperMessage?.idForLogging(),
        'for message',
        reaction?.source
      );

      const conversation = whisperMessage.getConversation();
      if (!conversation) {
        log.error(
          'can not get conversation for reaction',
          whisperMessage.idForLogging()
        );
        return;
      }

      return conversation.queueJob(async () => {
        do {
          const { source, emoji, remove } = reaction;
          const reactedMessage =
            await whisperMessage.loadMessageByRealSource(source);

          if (!reactedMessage) {
            log.error(
              'can not found original message',
              source,
              ' for reaction',
              whisperMessage.idForLogging()
            );
            break;
          }

          this.remove(emojiReaction);

          const savedReaction = {
            emoji,
            remove,
            fromId: whisperMessage.getSource(),
            timestamp: whisperMessage.get('sent_at'),
            source,
          };

          await reactedMessage.onReactionWithoutSave(savedReaction);

          await window.Signal.Data.saveMessage(reactedMessage.attributes, {
            Message: Whisper.Message,
          });
        } while (false);

        if (typeof confirm === 'function') {
          confirm();
        }
      });
    },
  }))();
})();
