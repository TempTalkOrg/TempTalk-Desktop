import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linkify } from './Linkify';
import { AddNewLines } from './AddNewLines';
import { LocalizerType, RenderTextCallbackType } from '../../types/Util';
import { MentionUser } from './MentionUser';
import { useDebounceFn, useMemoizedFn } from 'ahooks';
import classNames from 'classnames';
import ReactDOM, { createPortal } from 'react-dom';

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
  allowExpand?: boolean;
  isConfidentialMessage?: boolean;
  isMouseOver?: boolean;
  onClickMask?: (event: React.MouseEvent<HTMLDivElement>) => void;
  showOnMouseOver?: boolean;
  containerRef?: React.RefObject<HTMLDivElement>;
  onScrollIntoView?: () => void;
}

const renderNewLines: RenderTextCallbackType = ({
  text: textWithNewLines,
  key,
}) => <AddNewLines key={key} text={textWithNewLines} />;

function isTextTruncated(element: HTMLElement | null): boolean {
  if (!element) {
    return false;
  }

  const threshold = 1;

  return element.scrollHeight > element.clientHeight + threshold;
}

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
export const MessageBody = (props: Props) => {
  const {
    i18n,
    isConfidentialMessage,
    isMouseOver,
    suffixType,
    textPending,
    allowExpand,
    containerRef,
    onScrollIntoView,
  } = props;

  const shouldRedacted = isConfidentialMessage && !isMouseOver;

  const prefixText = useMemo(() => {
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
    } else {
      return `${i18n(i18nKey)} `;
    }
  }, [suffixType]);

  const renderTextMaskItem = useMemoizedFn((segment: string, index: number) => {
    const { showOnMouseOver } = props;
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
  });

  const renderTextMask = useMemoizedFn(() => {
    const { text } = props;

    return (
      <span className="message-body-text-mask">
        {text.split(/(\s+|\n)/).map((segment, index) => {
          return renderTextMaskItem(segment, index);
        })}
      </span>
    );
  });

  const renderBodyText = useMemoizedFn(() => {
    const { text, disableLinks, i18n, mentions, showOnMouseOver } = props;
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

    return <span>{renderNewLines({ text: textWithPending, key: 0 })}</span>;
  });

  const messageBodyWrapperRef = useRef<HTMLSpanElement>(null);
  const [expandable, setExpandable] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const expandIconRef = useRef<HTMLDivElement>(null);

  const { run: onWindowResize } = useDebounceFn(
    () => {
      const isTruncated = isTextTruncated(messageBodyWrapperRef.current);

      setExpandable(isTruncated);

      // reset expand status
      if (!isTruncated) {
        setExpanded(false);
      }
    },
    {
      wait: 50,
    }
  );

  useEffect(() => {
    if (!allowExpand) {
      return;
    }
    setTimeout(() => {
      const isTruncated = isTextTruncated(messageBodyWrapperRef.current);
      if (isTruncated) {
        setExpandable(true);
        window.addEventListener('resize', onWindowResize);
      }
    }, 20);

    return () => {
      if (!allowExpand) {
        return;
      }
      window.removeEventListener('resize', onWindowResize);
    };
  }, []);

  const onExpandChange = useMemoizedFn(() => {
    const iconOffsetTop = expandIconRef.current?.offsetTop ?? 0;
    const messageBodyBoundingClientRect =
      messageBodyWrapperRef.current?.getBoundingClientRect() ?? { height: 0 };

    const shouldAdjustMessagePosition =
      expanded &&
      expandIconRef.current &&
      messageBodyWrapperRef.current &&
      // padding top + line height * 20
      iconOffsetTop >= 12 + 16.5 * 20;

    const shouldRestoreBottomOffset =
      shouldAdjustMessagePosition &&
      iconOffsetTop >= messageBodyBoundingClientRect.height + 12;

    ReactDOM.flushSync(() => {
      setExpanded(prev => !prev);
    });

    // show less maybe need to adjust message position
    if (shouldAdjustMessagePosition) {
      if (shouldRestoreBottomOffset) {
        messageBodyWrapperRef.current?.dispatchEvent(
          new Event('message-view-collapsed', { bubbles: true })
        );
      } else {
        onScrollIntoView?.();
      }
    }
  });

  return (
    <>
      <span>
        <span
          ref={messageBodyWrapperRef}
          className={classNames([
            'module-message-body-wrapper',
            {
              'should-redacted': shouldRedacted,
              expanded,
            },
          ])}
        >
          {prefixText ? (
            <span className="module-message-body__highligh_red">
              {prefixText}
            </span>
          ) : null}
          {shouldRedacted ? renderTextMask() : renderBodyText()}
          {textPending ? (
            <span className="module-message-body__highlight">
              {' '}
              {i18n('downloading')}
            </span>
          ) : null}
        </span>
      </span>
      {expandable && containerRef?.current
        ? createPortal(
            <div
              ref={expandIconRef}
              className={classNames('message-body-expand-button', {
                expanded,
              })}
              onClick={onExpandChange}
            >
              {expanded ? 'Read Less' : 'Read More'}
            </div>,
            containerRef.current
          )
        : null}
    </>
  );
};
