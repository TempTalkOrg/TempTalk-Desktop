import { Message, UserMessage } from '../Message';
import { MentionsAt, MentionsQuote } from '../Mentions';

const getAtPersonList = (message: UserMessage) => {
  const { atPersons } = message;
  if (!atPersons) {
    return [];
  }

  return atPersons
    .split(';')
    ?.filter(person => person?.trim()?.length)
    ?.filter(person => /^\+[0-9]+$/.test(person) || person === 'MENTIONS_ALL');
};

const hasMentionsAt = (atPersons: Array<string>, ourNumber: string) => {
  if (!atPersons.length) {
    return MentionsAt.MENTIONS_AT_NONE;
  }

  const mentionsEachone =
    MentionsAt.MENTIONS_AT_YOU |
    MentionsAt.MENTIONS_AT_ALL |
    MentionsAt.MENTIONS_AT_OTHERS;

  let mentionsAtFlags: number = MentionsAt.MENTIONS_AT_NONE;
  for (const atPerson of atPersons) {
    if (atPerson === ourNumber) {
      mentionsAtFlags |= MentionsAt.MENTIONS_AT_YOU;
    } else if (atPerson === 'MENTIONS_ALL') {
      mentionsAtFlags |= MentionsAt.MENTIONS_AT_ALL;
    } else {
      mentionsAtFlags |= MentionsAt.MENTIONS_AT_OTHERS;
    }

    if (mentionsEachone == mentionsAtFlags) {
      break;
    }
  }

  return mentionsAtFlags;
};

const hasMentionsQuote = (message: UserMessage, ourNumber: string) => {
  const { quote } = message;
  if (!quote) {
    return MentionsQuote.MENTIONS_QUOTE_NONE;
  }

  const { author } = quote;
  if (author && author === ourNumber) {
    return MentionsQuote.MENTIONS_QUOTE_YOU;
  } else {
    return MentionsQuote.MENTIONS_QUOTE_OTHERS;
  }
};

export const initializeMentionMetadata = async (
  message: Message,
  context: { ourNumber: string }
): Promise<Message> => {
  if (message.type === 'verified-change') {
    return message;
  }

  const atPersonList = getAtPersonList(message);

  return {
    ...message,
    mentionsAtFlags: hasMentionsAt(atPersonList, context.ourNumber),
    mentionsQuoteFlags: hasMentionsQuote(message, context.ourNumber),
  };
};
