import { Input, Popover, Tooltip } from 'antd';
import React, { useRef, useState } from 'react';
import { IconCallEmoji } from '../../../../shared/icons';
import { useGlobalConfig } from '../../../hooks/useGlobalConfig';
import { useClickAway, useKeyPress, useMemoizedFn } from 'ahooks';

interface IProps {
  onSendMessage?: (text: string) => void;
  presetTexts?: string[];
  bubbleMessagePresets?: string[];
  onSendBubbleMessage?: (text: string) => void;
}

const SenderPopoverContent = ({
  onSendBubbleMessage,
  onSendMessage,
  onClose,
}: {
  onSendBubbleMessage?: (text: string) => void;
  onSendMessage?: (text: string) => void;
  onClose?: () => void;
}) => {
  const globalConfig = useGlobalConfig();
  const emojiPresets = globalConfig.bubbleMessage?.emojiPresets || [];
  const textPresets = globalConfig.bubbleMessage?.textPresets || [];
  const maxLength = globalConfig.chatMessage?.maxLength || 30;

  const textIndexOffset = emojiPresets.length + 1;
  const totalPresets = [...emojiPresets, ...textPresets];

  const [inputValue, setInputValue] = useState('');

  const handleItemClick = (text: string) => {
    if (onSendBubbleMessage) {
      onSendBubbleMessage(text);
      onClose?.();
    }
  };

  const onPressEnter = () => {
    const text = inputValue.trim();
    if (text) {
      onSendMessage?.(text);
      setInputValue('');
      onClose?.();
    }
  };

  const keyFilter = (event: KeyboardEvent) => {
    return ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].includes(
      event.key
    );
  };

  const handleKeyPress = useMemoizedFn((event: KeyboardEvent) => {
    const keyNumber = Number(event.key);
    const index = keyNumber === 0 ? 9 : keyNumber - 1;
    const text = totalPresets[index];
    if (text) {
      onSendBubbleMessage?.(text);
      onClose?.();
    }
  });

  useKeyPress(keyFilter, handleKeyPress, {
    exactMatch: true,
  });

  return (
    <div className="message-sender-popover-content">
      <div className="message-sender-emoji-row">
        {emojiPresets.map((emoji, index) => (
          <div
            key={index}
            className="message-sender-item emoji-item"
            onClick={() => handleItemClick(emoji)}
          >
            <span className="message-sender-shortcut">{index + 1}</span>
            <div className="message-sender-emoji-wrapper">
              <span className="message-sender-emoji">{emoji}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="message-sender-text-row">
        {textPresets.map((text, index) => (
          <div
            key={index}
            className="message-sender-item text-item"
            onClick={() => handleItemClick(text)}
          >
            <span className="message-sender-shortcut">
              {index + textIndexOffset === 10 ? '0' : index + textIndexOffset}
            </span>
            <span className="message-sender-text">{text}</span>
          </div>
        ))}
      </div>

      <div className="message-sender-divider" />

      <div className="message-sender-footer">
        <Input
          value={inputValue}
          onKeyDown={e => {
            e.stopPropagation();
          }}
          onChange={e => setInputValue(e.target.value)}
          variant="borderless"
          className="message-sender-input"
          placeholder="Message to all ( or try press '1' to send reaction)"
          onPressEnter={onPressEnter}
          maxLength={maxLength}
        />
      </div>
    </div>
  );
};

export const MessageSender = (props: IProps) => {
  const [presetArea, setPresetArea] = useState(false);
  const { onSendBubbleMessage, onSendMessage } = props;

  const keyFilter = (event: KeyboardEvent) => {
    return ['r'].includes(event.key);
  };

  const handleKeyPress = useMemoizedFn(() => {
    setPresetArea(prev => !prev);
  });

  useKeyPress(keyFilter, handleKeyPress, {
    exactMatch: true,
  });

  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useClickAway(() => {
    setPresetArea(false);
  }, [triggerRef, popoverRef]);

  return (
    <div className="message-sender-container" ref={triggerRef}>
      <Tooltip placement="top" title="Press R">
        <div
          className="message-sender-icon-wrapper"
          onClick={() => {
            setPresetArea(prev => !prev);
          }}
        >
          <IconCallEmoji className="send-message-icon" />
        </div>
      </Tooltip>

      <div ref={popoverRef}></div>
      <Popover
        getPopupContainer={() => popoverRef.current || document.body}
        trigger={['click']}
        placement="topLeft"
        className="message-sender-popover"
        arrow={false}
        content={
          <SenderPopoverContent
            onSendBubbleMessage={onSendBubbleMessage}
            onSendMessage={onSendMessage}
            onClose={() => setPresetArea(false)}
          />
        }
        open={presetArea}
        align={{
          offset: [-18, -38],
        }}
        destroyTooltipOnHide={true}
        overlayClassName={'message-sender-popover'}
      ></Popover>
    </div>
  );
};
