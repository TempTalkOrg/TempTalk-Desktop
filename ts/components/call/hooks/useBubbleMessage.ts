import { useMemoizedFn } from 'ahooks';
import { uniqBy } from 'lodash';
import { useState } from 'react';
import { Contact } from './useInitials';
import { useGlobalConfig } from './useGlobalConfig';
import { EmojiRegex } from '../../../util/emoji';

export const getKey = (message: BubbleMessage) =>
  `${message.timestamp}_${message.identity}`;

export type BubbleMessage = {
  identity: string;
  text: string;
  column: number;
  speed: number;
  timestamp: number;
  name: string;
  textContent: string;
  emojiContent: string;
};

export const useBubbleMessage = ({
  contactMap,
}: {
  contactMap: Map<string, Contact>;
}) => {
  const globalConfig = useGlobalConfig();
  const columnConfig = globalConfig.bubbleMessage?.columns || [10, 40, 70];
  const baseSpeed = globalConfig.bubbleMessage?.baseSpeed || 4600;
  const deltaSpeed = globalConfig.bubbleMessage?.deltaSpeed || 400;

  const getRandomColumn = useMemoizedFn(() =>
    Math.min(100, columnConfig[Math.floor(Math.random() * columnConfig.length)])
  );

  const getRandomSpeed = useMemoizedFn(() => {
    return Math.round(Math.random() * deltaSpeed + baseSpeed);
  });

  const generateDisplayContent = useMemoizedFn((rawText: string = '') => {
    const emojis = rawText.match(EmojiRegex) || [];
    const emoji = emojis.join('');
    const pureText = rawText.replace(EmojiRegex, '').trim();

    return {
      textContent: pureText,
      emojiContent: emoji,
    };
  });

  const [bubbleMessages, setBubbleMessages] = useState<BubbleMessage[]>([]);

  const addBubbleMessage = useMemoizedFn(
    (message: { identity: string; text: string }) => {
      const { identity, text } = message;
      const column = getRandomColumn();
      const speed = getRandomSpeed();
      const timestamp = Date.now();

      const displayContent = generateDisplayContent(text);

      const item: BubbleMessage = {
        identity,
        text,
        ...displayContent,
        column,
        speed,
        timestamp,
        name: contactMap.get(identity.split('.')[0])?.getDisplayName() || '',
      };

      setBubbleMessages(prev =>
        uniqBy([...prev, item], getKey).filter(Boolean)
      );
      setTimeout(() => {
        setBubbleMessages(prev => prev.filter(m => getKey(m) !== getKey(item)));
      }, speed);
    }
  );

  const onReset = useMemoizedFn((item: BubbleMessage) => {
    setBubbleMessages(prev => prev.filter(m => getKey(m) !== getKey(item)));
  });

  return { bubbleMessages, addBubbleMessage, onReset };
};
