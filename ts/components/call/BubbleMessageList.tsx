import React from 'react';
import { useTransition, animated, easings } from '@react-spring/web';
import { BubbleMessage, getKey } from './hooks/useBubbleMessage';

export const BubbleMessageList = ({
  messages,
  onRest,
}: {
  messages: BubbleMessage[];
  onRest: (item: BubbleMessage) => void;
}) => {
  const transitions = useTransition<
    {
      column: number;
      speed: number;
      textContent: string;
      emojiContent: string;
      name: string;
    },
    object
  >(messages, {
    from: item => ({
      top: '100%',
      opacity: 1,
      left: `calc(${item.column}% - ${item.column <= 10 ? 0 : 50}px)`,
    }),
    enter: item => [
      {
        top: '20%',
        opacity: 1,
        config: {
          easing: easings.easeOutQuad,
        },
        left: `${item.column}%`,
      },
    ],
    leave: { opacity: 0 },
    config: item => ({
      duration: item?.speed || 5000,
    }),
    onRest: (_, __, item: BubbleMessage) => {
      onRest?.(item);
    },
    keys: getKey,
  });

  return (
    <div className="bubble-message-container">
      {messages.length > 0 &&
        transitions((style, item) => {
          return (
            <animated.div
              className={'bubble-message-item'}
              style={{
                ...style,
                opacity: style.top.to((v: any) => {
                  const start = 100;
                  const end = 20;
                  const current = parseFloat(v);
                  const progress = (start - current) / (start - end);
                  if (progress < 0.7) {
                    return 1;
                  }
                  return 1 - (progress - 0.7) / 0.3;
                }),
              }}
            >
              <div className="bubble-message-emoji">{item.emojiContent}</div>
              <div className="bubble-message-text">
                <div className="bubble-message-text-name">{item.name}</div>
                {item.textContent && (
                  <div className="bubble-message-text-content">
                    {` : ${item.textContent}`}
                  </div>
                )}
              </div>
            </animated.div>
          );
        })}
    </div>
  );
};
