import emojiRegex from 'emoji-regex';

export const EmojiRegex = emojiRegex();

export const isOnlyOneEmoji = (s: string) => {
  if (s.length > 16) {
    return false;
  }

  let emojiCount = 0;
  let isOnlyEmoji;
  const items = s.matchAll(EmojiRegex);
  for (const match of items) {
    isOnlyEmoji = match[0] === s;
    emojiCount += 1;
  }
  return isOnlyEmoji && emojiCount === 1;
};
