import LinkifyIt from 'linkify-it';
const linkify = LinkifyIt();

linkify.add('chative:', 'http:');
linkify.add('temptalk:', 'http:');

const SUPPORTED_PROTOCOLS = /^(http|https|chative|temptalk):/i;
const HAS_AT = /@/;
const START_WITH_LETTER_OR_NUMBER = /^[A-Z0-9]/i;
export function urlMatch(url: string) {
  let matchData = linkify.match(url);
  const results: Array<any> = [];
  let filterResults;

  if (matchData && matchData.length > 0) {
    matchData = matchData.filter(d => d); //去除掉里面的null值
    matchData.forEach(
      (match: {
        index: number;
        url: string;
        lastIndex: number;
        text: string;
      }) => {
        const { url, text: originalText } = match;

        const isTextStartWithLetterOrNumber =
          START_WITH_LETTER_OR_NUMBER.test(originalText);
        if (
          isTextStartWithLetterOrNumber &&
          SUPPORTED_PROTOCOLS.test(url) &&
          !HAS_AT.test(url)
        ) {
          results.push(url);
        }
      }
    );
    filterResults = Array.from(new Set(Array.from(results)));
  }

  return filterResults;
}
