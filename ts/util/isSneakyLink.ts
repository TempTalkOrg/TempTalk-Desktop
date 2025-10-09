import nodeUrl from 'node:url';
import { isString } from 'lodash';

export const FULL_END_BRACKET = '\uFF09';
export const HALF_END_BRACKET = '\u0029';

export const isBracket = (char: string): boolean => {
  return char === HALF_END_BRACKET || char === FULL_END_BRACKET;
};

export const isNonAscii = (char: string): boolean => {
  return char >= '\u0080';
};
export function maybeParseUrl(value: string): undefined | URL {
  if (typeof value === 'string') {
    try {
      return new URL(value);
    } catch {
      /* Errors are ignored. */
    }
  }

  return undefined;
}

// Rejects: "http://türkiye.com" (non-ASCII characters)
// Rejects: "http://xn--trkiye-3ya.com" (Punycode)
// Accepts: "http://example.com"
// Accepts: "https://sub.example.com/path?query=1"
// Accepts: "https://google.com"
// Rejects: "https://xn--eby-7cd.com/"
// Rejects: "https://ebаy.com"
// Rejects: "https://xn--fiq228c.com/"
// Rejects: "https://中文.com"
// Rejects: "http://xn--trkiye-3ya.com"
// Accepts: "https://google.com）下载"(https://google.com)
// Accepts: "https://google.com)下载"(https://google.com)
// Accepts: "https://baidu.com/sdfsdf?a=(fff)"
// Rejects: https://google.cаm -> а is non-ASCII
// Rejects: https://google.com中文 -> 中文 is non-ASCII

export function isSneakyLink(link: string): boolean {
  if (!isString(link)) {
    return false;
  }

  const url = maybeParseUrl(link);
  if (!url || !url.hostname) {
    return false;
  }
  const hostname = url.hostname;
  const unicodeDomain = nodeUrl.domainToUnicode(hostname);

  const fullEndbracketIndex = unicodeDomain.indexOf(FULL_END_BRACKET);
  const halfEndbracketIndex = unicodeDomain.indexOf(HALF_END_BRACKET);

  if (fullEndbracketIndex !== -1 || halfEndbracketIndex !== -1) {
    const endbracketIndex =
      fullEndbracketIndex !== -1 ? fullEndbracketIndex : halfEndbracketIndex;
    const cutoff = unicodeDomain.slice(0, endbracketIndex);
    const cutoffAsciiDomain = nodeUrl.domainToASCII(cutoff);
    return cutoffAsciiDomain !== cutoff;
  }

  const asciiDomain = nodeUrl.domainToASCII(hostname);

  return asciiDomain !== unicodeDomain;
}
