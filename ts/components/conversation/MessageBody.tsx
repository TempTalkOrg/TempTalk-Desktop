import React from 'react';

import { Linkify } from './Linkify';
import { AddNewLines } from './AddNewLines';
import { LocalizerType, RenderTextCallbackType } from '../../types/Util';
import { MentionUser } from './MentionUser';

export interface Props {
  suffixType?: 'atYou' | 'atAll' | 'draft' | undefined;
  text: string;
  textPending?: boolean;
  mentions?: Array<any>;
  /** If set, all emoji will be the same size. Otherwise, just one emoji will be large. */
  disableJumbomoji?: boolean;
  /** If set, links will be left alone instead of turned into clickable `<a>` tags. */
  disableLinks?: boolean;
  i18n: LocalizerType;
  notificationSetting?: number;

  isConfidentialMessage?: boolean;
  isMouseOver?: boolean;
  onClickMask?: (event: React.MouseEvent<HTMLDivElement>) => void;
  showOnMouseOver?: boolean;
}

const renderNewLines: RenderTextCallbackType = ({
  text: textWithNewLines,
  key,
}) => <AddNewLines key={key} text={textWithNewLines} />;

// https://stackoverflow.com/questions/43242440/javascript-regular-expression-for-unicode-emoji
// https://regex101.com/r/ZP389q/3
// const EMOJI_REG =
//   /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/gu;

/**
 * This component makes it very easy to use all three of our message formatting
 * components: `Emojify`, `Linkify`, and `AddNewLines`. Because each of them is fully
 * configurable with their `renderXXX` props, this component will assemble all three of
 * them for you.
 */
export class MessageBody extends React.Component<Props> {
  public renderPrefix() {
    const { i18n, suffixType } = this.props;

    let i18nKey;

    switch (suffixType) {
      case 'atYou':
        i18nKey = 'youAreMentioned';
        break;
      case 'atAll':
        i18nKey = 'allAreMentioned';
        break;
      case 'draft':
        i18nKey = 'prefixDraft';
        break;
      default:
    }

    if (!i18nKey) {
      return null;
    }

    return (
      <span className="module-message-body__highligh_red">
        {i18n(i18nKey)}{' '}
      </span>
    );
  }

  public renderSuffix() {
    const { i18n, textPending } = this.props;

    if (!textPending) {
      return null;
    }

    return (
      <span className="module-message-body__highlight">
        {' '}
        {i18n('downloading')}
      </span>
    );
  }

  // public shouldShowBiggerEmoji(s: string) {
  //   if (s.length > 16) {
  //     return false;
  //   }
  //   if (s.match(EMOJI_REG)) {
  //     // @ts-ignore
  //     let segmenter = new Intl.Segmenter({ granularity: 'grapheme' });
  //     let segments = segmenter.segment(s);
  //     return Array.from(segments).length === 1;
  //   }
  //   return false;
  // }
  public renderTextMaskItem(segment: string, index: number) {
    const { showOnMouseOver } = this.props;
    if (segment.trim() === '' || segment === '&nbsp;') {
      return segment;
    } else {
      return (
        <span key={index} className="message-body-text-mask-item">
          {segment.startsWith('@') ? (
            <MentionUser
              uid={index.toString()}
              text={segment}
              type={1}
              disableShowProfile={showOnMouseOver}
            />
          ) : (
            <Linkify text={segment} disableShowProfile={showOnMouseOver} />
          )}
        </span>
      );
    }
  }
  public renderTextMask() {
    const { text } = this.props;

    return (
      <span className="message-body-text-mask">
        {text.split(/(\s+|\n)/).map((segment, index) => {
          return this.renderTextMaskItem(segment, index);
        })}
      </span>
    );
  }

  public renderBodyText() {
    const { text, textPending, disableLinks, i18n, mentions, showOnMouseOver } =
      this.props;
    const textWithPending = textPending ? `${text}...` : text;
    if (!disableLinks) {
      return (
        <Linkify
          text={textWithPending}
          i18n={i18n}
          mentions={mentions}
          disableShowProfile={showOnMouseOver}
        />
      );
    }

    // const style: any = {};
    // if (this.shouldShowBiggerEmoji(textWithPending)) {
    //   style.fontSize = '16px';
    // }

    return <span>{renderNewLines({ text: textWithPending, key: 0 })}</span>;
  }

  public render() {
    const { isConfidentialMessage, isMouseOver } = this.props;

    const shouldRedacted = isConfidentialMessage && !isMouseOver;

    return (
      <span>
        <span>
          {this.renderPrefix()}
          {shouldRedacted ? this.renderTextMask() : this.renderBodyText()}
          {this.renderSuffix()}
        </span>
      </span>
    );
  }
}
