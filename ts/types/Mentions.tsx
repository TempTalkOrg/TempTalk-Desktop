export enum MentionsAt {
  MENTIONS_AT_NONE = 0x0,
  MENTIONS_AT_YOU = 0x1,
  MENTIONS_AT_ALL = 0x2,
  MENTIONS_AT_OTHERS = 0x4,
}

export enum MentionsQuote {
  MENTIONS_QUOTE_NONE = 0x0,
  MENTIONS_QUOTE_YOU = 0x1,
  MENTIONS_QUOTE_OTHERS = 0x2,
}

// mentions AT you
export function hasMentionsAtYou(flags: number): boolean {
  return !!(flags & MentionsAt.MENTIONS_AT_YOU);
}

export function addMentionsAtYou(flags: number): number {
  return flags | MentionsAt.MENTIONS_AT_YOU;
}

// mentions AT all
export function hasMentionsAtAll(flags: number): boolean {
  return !!(flags & MentionsAt.MENTIONS_AT_ALL);
}

export function addMentionsAtAll(flags: number): number {
  return flags | MentionsAt.MENTIONS_AT_ALL;
}

// mentions AT others
export function hasMentionsAtOthers(flags: number): boolean {
  return !!(flags & MentionsAt.MENTIONS_AT_OTHERS);
}

export function addMentionsAtOthers(flags: number): number {
  return flags | MentionsAt.MENTIONS_AT_OTHERS;
}

// mentions QUOTE you
export function hasMentionsQuoteYou(flags: number): boolean {
  return !!(flags & MentionsQuote.MENTIONS_QUOTE_YOU);
}

export function addMentionsQuoteYou(flags: number): number {
  return flags | MentionsQuote.MENTIONS_QUOTE_YOU;
}

// mentions QUOTE others
export function hasMentionsQuoteOthers(flags: number): boolean {
  return !!(flags & MentionsQuote.MENTIONS_QUOTE_OTHERS);
}

export function addMentionsQuoteOthers(flags: number): number {
  return flags | MentionsQuote.MENTIONS_QUOTE_OTHERS;
}

// mentions you: include AT you & QUOTE you
export function hasMentionsYou(atFlags?: number, quoteFlags?: number): boolean {
  return (
    hasMentionsAtYou(atFlags || MentionsAt.MENTIONS_AT_NONE) ||
    hasMentionsQuoteYou(quoteFlags || MentionsQuote.MENTIONS_QUOTE_NONE)
  );
}

// mentions you & all: include AT you & AT all & QUOTE you
export function hasMentionsYouOrAll(
  atFlags?: number,
  quoteFlags?: number
): boolean {
  return (
    hasMentionsYou(atFlags, quoteFlags) ||
    hasMentionsAtAll(atFlags || MentionsAt.MENTIONS_AT_NONE)
  );
}
