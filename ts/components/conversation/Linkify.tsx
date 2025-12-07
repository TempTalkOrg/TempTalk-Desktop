import React from 'react';
import emojiRegex from 'emoji-regex';
import linkify from 'linkifyjs';

import { LocalizerType, RenderTextCallbackType } from '../../types/Util';
import { MentionUser } from './MentionUser';
import { isSneakyLink } from '../../util';
import nodeUrl from 'node:url';
import { isBracket, isNonAscii, maybeParseUrl } from '../../util/isSneakyLink';
import { findIndex } from 'lodash';

const REGEXP = emojiRegex();

linkify.registerCustomProtocol('chative');
linkify.registerCustomProtocol('temptalk');

// https://stackoverflow.com/questions/43242440/javascript-regular-expression-for-unicode-emoji
// https://regex101.com/r/ZP389q/3
// const EMOJI_REG =
//   /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/gu;

interface Props {
  text: string;
  i18n: LocalizerType;
  mentions?: Array<any>;
  /** Allows you to customize now non-links are rendered. Simplest is just a <span>. */
  renderNonLink?: RenderTextCallbackType;
  disableShowProfile?: boolean;
}

const SUPPORTED_PROTOCOLS = /^(http|https|chative|temptalk):/i;
const HAS_AT = /@/;
const START_WITH_LETTER_OR_NUMBER = /^[A-Z0-9]/i;

export class Linkify extends React.Component<Props, { countStr: string }> {
  hrefClickBind: (
    event: React.MouseEvent<HTMLAnchorElement, MouseEvent>
  ) => void;

  constructor(props: Readonly<Props>) {
    super(props);
    this.state = {
      countStr: Math.random().toString(36).slice(-8),
    };
    this.hrefClickBind = this.hrefClick.bind(this);
  }

  public static defaultProps: Partial<Props> = {
    renderNonLink: ({ text }) => text,
  };

  // @ts-ignore
  public async hrefClick(
    event: React.MouseEvent<HTMLAnchorElement, MouseEvent>
  ) {
    const href = event?.currentTarget?.href;
    if (!href) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    (window as any).sendBrowserOpenUrl(href);
  }

  public shouldShowBiggerEmoji(s: string) {
    if (s.length > 16) {
      return false;
    }

    // if (s.match(EMOJI_REG)) {
    //   // @ts-ignore
    //   let segmenter = new Intl.Segmenter({ granularity: 'grapheme' });
    //   let segments = segmenter.segment(s);
    //   return Array.from(segments).length === 1;
    // }
    // return false;

    let emojiCount = 0;
    let isOnlyEmoji;
    //@ts-ignore
    const items = s.matchAll(REGEXP);
    for (const match of items) {
      isOnlyEmoji = match[0] === s;
      emojiCount += 1;
    }
    return isOnlyEmoji && emojiCount === 1;
  }

  public analyzeURL(text: string) {
    const results: Array<any> = [];
    let last = 0;
    const countStr = this.state.countStr;
    let count = 0;

    if (this.shouldShowBiggerEmoji(text)) {
      return (
        <span
          style={{ fontSize: '26px', lineHeight: '32px' }}
          key={countStr + count++}
          className="bigger-emoji"
        >
          {text}
        </span>
      );
    }

    const matchDataOld: {
      type: string;
      value: string;
      isLink: boolean;
      href: string;
      start: number;
      end: number;
    }[] = linkify.find(text, {
      defaultProtocol: '', // 设定为空字符串, 讓沒有schema的鏈接視為一般文本
    });

    if (matchDataOld.length === 0) {
      return <span key={countStr + count++}>{text}</span>;
    }

    const matchData: Array<{
      index: number;
      url: string;
      lastIndex: number;
      text: string;
    }> = matchDataOld
      .map(d => {
        if (!d?.isLink || isSneakyLink(d.href)) {
          return undefined;
        }

        const checkHostname = (hostname: string) => {
          if (!hostname) {
            return false;
          }
          const unicodeHostname = nodeUrl.domainToUnicode(hostname);
          return [...unicodeHostname].some(
            char => isNonAscii(char) || isBracket(char)
          );
        };

        const url = maybeParseUrl(d.href);
        const hasNonAsciiOrBracketInHostname = url
          ? checkHostname(url.hostname)
          : false;

        // 如果是hostname 有非ascii字符/全角/半角括号，则需要截断, 其他则不需要截断全角/半角括号
        const firstDeniedIndex = hasNonAsciiOrBracketInHostname
          ? findIndex(d.href, char => isNonAscii(char) || isBracket(char))
          : findIndex(d.href, isNonAscii);

        if (firstDeniedIndex === -1) {
          return {
            index: d.start,
            lastIndex: d.end,
            text: d.value,
            url: d.href,
          };
        }

        const cleanUrl = d.href.slice(0, firstDeniedIndex);

        const displayText = d.value.slice(0, firstDeniedIndex);
        const lastIndex = d.start + displayText.length;
        return {
          index: d.start,
          lastIndex,
          text: displayText,
          url: cleanUrl,
        };
      })
      .filter(item => item !== undefined);

    matchData.forEach(match => {
      if (last < match.index) {
        const textWithNoLink = text.slice(last, match.index);
        results.push(<span key={countStr + count++}>{textWithNoLink}</span>);
      }

      const { url, text: originalText } = match;

      const isTextStartWithLetterOrNumber =
        START_WITH_LETTER_OR_NUMBER.test(originalText);
      if (
        isTextStartWithLetterOrNumber &&
        SUPPORTED_PROTOCOLS.test(url) &&
        !HAS_AT.test(url)
      ) {
        // 默认使用https
        if (url === 'http://' + originalText) {
          results.push(
            <a
              key={countStr + count++}
              href={'https://' + originalText}
              onClick={this.hrefClickBind}
            >
              {originalText}
            </a>
          );
        } else {
          results.push(
            <a key={countStr + count++} href={url} onClick={this.hrefClickBind}>
              {originalText}
            </a>
          );
        }
      } else {
        results.push(<span key={countStr + count++}>{originalText}</span>);
      }
      last = match.lastIndex;
    });

    if (last < text.length) {
      results.push(<span key={countStr + count++}>{text.slice(last)}</span>);
    }

    return <>{results}</>;
  }

  public analyzeText(text: string, mentions: Array<any> | undefined) {
    if (!mentions || mentions.length === 0) {
      return this.analyzeURL(text);
    }

    // 必须排序，否则无法遍历数组
    mentions.sort((left: any, right: any) => {
      return left.start - right.start;
    });

    let mergedSpans: any[] = [];
    let index = 0;
    let curPosition = 0;
    while (index < mentions.length) {
      const { start, length, uid, type } = mentions[index];

      // check params
      if (start < curPosition) {
        console.log(
          'Linkify.tsx Bad message mentions params:' +
            text +
            '===>' +
            JSON.stringify(mentions)
        );
        break;
      }

      // prefix
      const prefixString = text.substring(curPosition, start);
      if (prefixString) {
        mergedSpans = mergedSpans.concat(this.analyzeURL(prefixString));
      }

      // mention
      mergedSpans.push(
        <MentionUser
          key={uid + index}
          text={text.substring(start, start + length)}
          uid={uid}
          type={type}
          disableShowProfile={this.props.disableShowProfile}
        />
      );

      // curPosition
      curPosition = start + length;

      index += 1;
    }

    const lastString = text.substring(curPosition);
    if (lastString) {
      const result = this.analyzeURL(lastString);
      if (result) {
        for (let i = 0; i < result.props.children.length; i++) {
          mergedSpans = mergedSpans.concat(result.props.children[i]);
        }
      }
      // mergedSpans = mergedSpans.concat(this.analyzeURL(lastString, index));
    }

    return mergedSpans;
  }

  public render() {
    const { text, mentions } = this.props; //整个文本
    return this.analyzeText(text, mentions);
  }
}
