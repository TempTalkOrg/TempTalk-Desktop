import React, { useEffect, useRef, useState } from 'react';
import { Message } from '../Message';
import { useMemoizedFn } from 'ahooks';
import { StickyDateSeparator } from '../../StickyDateSeparator';
import { LocalizerType } from '../../../types/Util';

type ForwardedMessageType = {
  id: number;
  dateTimestamp: number;
  dateSeparator: string;
  virtualIndex: number;
};

interface IProps {
  messages: ForwardedMessageType[];
  i18n: LocalizerType;
  beforeRemove: () => void;
}

export const ForwardedMessageList = (props: IProps) => {
  const { messages, i18n, beforeRemove } = props;

  const containerRef = useRef<HTMLUListElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const showingMessagesSetRef = useRef<Set<number>>(new Set());

  const [stickyDateProps, setStickyDateProps] = useState<any>({});
  const scrollInfoRef = useRef({ scrolling: false, scrollTop: 0 });

  const updateStickyDateView = useMemoizedFn(() => {
    const stickyDateTime = messages.filter(item =>
      showingMessagesSetRef.current.has(item.id)
    )[0].dateTimestamp;

    if (!stickyDateTime) {
      return;
    }

    setStickyDateProps({
      timestamp: stickyDateTime,
      shouldShow:
        scrollInfoRef.current.scrolling ||
        scrollInfoRef.current.scrollTop === 0,
      autoHideFlag: !scrollInfoRef.current.scrolling,
    });
  });

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    observerRef.current = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          const { target, isIntersecting } = entry;
          const targetId = Number(target.id);

          if (isIntersecting) {
            const model = messages.find(item => item.id === targetId);
            if (model) {
              showingMessagesSetRef.current.add(targetId);
            }
          } else {
            showingMessagesSetRef.current.delete(targetId);
          }

          updateStickyDateView();
        });
      },
      {
        root: containerRef.current,
        threshold: 0,
      }
    );

    const children = Array.from(
      containerRef.current?.querySelector('.messages')?.children || []
    );
    children.forEach(child => {
      observerRef.current?.observe(child);
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      beforeRemove();
    };
  }, []);

  const onScroll = useMemoizedFn(() => {
    scrollInfoRef.current.scrolling = true;
    scrollInfoRef.current.scrollTop = containerRef.current?.scrollTop || 0;
    updateStickyDateView();
  });

  const onScrollEnd = useMemoizedFn(() => {
    scrollInfoRef.current.scrolling = false;
    updateStickyDateView();
  });

  useEffect(() => {
    containerRef.current?.addEventListener('scroll', onScroll);
    containerRef.current?.addEventListener('scrollend', onScrollEnd);

    return () => {
      containerRef.current?.removeEventListener('scroll', onScroll);
      containerRef.current?.removeEventListener('scrollend', onScrollEnd);
    };
  }, []);

  return (
    <div className="forwarded-message-container">
      <ul
        ref={containerRef}
        className="forwarded-message-list"
        style={{ height: 'calc(100vh - 58px)', overflow: 'auto' }}
      >
        <div className="sticky-date">
          <StickyDateSeparator {...stickyDateProps} i18n={i18n} />
        </div>
        <div className="messages">
          {messages.map((item: ForwardedMessageType) => (
            <div key={item.id} id={String(item.id)}>
              <div className="message-wrapper-outer">
                <Message {...(item as any)} i18n={i18n} />
              </div>
            </div>
          ))}
        </div>
      </ul>
    </div>
  );
};
