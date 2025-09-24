import { Message } from './Message';

interface ConversationLastMessageUpdate {
  lastMessage: string;
  lastMessageStatus: string | null;
  timestamp: number | null;
  lastMessageVersion: number | null;
}

export const createLastMessageUpdate = ({
  currentTimestamp,
  lastMessage,
  lastMessageStatus,
  lastMessageNotificationText,
  lastMessageVersion,
}: {
  currentTimestamp?: number;
  lastMessage?: Message;
  lastMessageStatus?: string;
  lastMessageNotificationText?: string;
  lastMessageVersion?: number;
}): ConversationLastMessageUpdate => {
  if (!lastMessage) {
    return {
      lastMessage: '',
      lastMessageStatus: null,
      timestamp: null,
      lastMessageVersion: null,
    };
  }

  const { type, expirationTimerUpdate } = lastMessage;
  const isVerifiedChangeMessage = type === 'verified-change';
  const isExpireTimerUpdateFromSync = Boolean(
    expirationTimerUpdate && expirationTimerUpdate.fromSync
  );

  const shouldUpdateTimestamp = Boolean(
    !isVerifiedChangeMessage && !isExpireTimerUpdateFromSync
  );
  const newTimestamp = shouldUpdateTimestamp
    ? lastMessage.serverTimestamp || lastMessage.sent_at
    : currentTimestamp;

  const shouldUpdateLastMessageText = !isVerifiedChangeMessage;
  const newLastMessageText = shouldUpdateLastMessageText
    ? lastMessageNotificationText
    : '';

  return {
    lastMessage: newLastMessageText || '',
    lastMessageStatus: lastMessageStatus || null,
    timestamp: newTimestamp || null,
    lastMessageVersion: lastMessageVersion || null,
  };
};
