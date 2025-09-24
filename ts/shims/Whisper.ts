import { UserStorage } from './storage';

export function getMessageModel(attributes: any) {
  // @ts-ignore
  return new window.Whisper.Message(attributes);
}

export function getMessageCollection(attributesArray: Array<any>) {
  // @ts-ignore
  return new window.Whisper.MessageCollection(attributesArray);
}

export function getConversationModel(conversationId?: string) {
  if (typeof conversationId !== 'string' || !conversationId) {
    console.log('invalid conversation id', conversationId);
    return null;
  }

  // @ts-ignore
  return window.ConversationController.get(conversationId);
}

export function getConversationProps(
  conversationId: string,
  ourNumber?: string
) {
  const model = getConversationModel(conversationId);

  let isMe = false;

  if (ourNumber) {
    if (ourNumber === conversationId) {
      isMe = true;
    }
  } else {
    if (conversationId === UserStorage.getNumber()) {
      isMe = true;
    }
  }

  if (model) {
    return {
      ...model.format(),
      isMe,
    };
  } else {
    return {
      id: conversationId,
      name: conversationId,
      isArchived: false,
      timestamp: 0,
      phoneNumber: conversationId,
      type: 'direct',
      isMe,
      lastUpdated: 0,
      unreadCount: 0,
      isSelected: false,
      isTyping: false,
    };
  }
}

export function isBot(id: string) {
  return (window as any).Signal.ID.isBotId(id);
}

export async function getOrCreateConversationModel(
  conversationId: string,
  type: 'private' | 'group'
) {
  if (typeof conversationId !== 'string' || !conversationId) {
    console.log('invalid conversation id', conversationId);
    return null;
  }

  if (!['private', 'group'].includes(type)) {
    console.log('invalid type', type);
    return null;
  }

  try {
    // @ts-ignore
    return await window.ConversationController.getOrCreateAndWait(
      conversationId,
      type
    );
  } catch (error) {
    console.warn('could not get or create conversation modal');
    return null;
  }
}
