import { Popover } from 'antd';
import React, { useMemo, useState } from 'react';
// import { SendMessage } from '../assets/icons';

interface IProps {
  onSendMessage?: (text: string) => void;
  presetTexts?: string[];
}

const defaultPresetTexts = [
  'Good 👍',
  'Agree ✅',
  'Disagree ❌',
  'Bad 😝',
  "Can't hear you. Bad Signal",
  "Can't hear you. Your voice is too low",
  'Please make screen bigger',
  'Please go faster',
  'Gotta go, bye',
];

const splitGroup = (arr: string[]): Array<string[]> => {
  const middleNum = Math.ceil(arr.length / 2);

  return arr.reduce(
    (sum, item, i) => {
      const order = i < middleNum ? 0 : 1;
      (sum[order] as string[]).push(item);

      return sum;
    },
    [[], []]
  );
};

export const MessageSender = (props: IProps) => {
  const [inputText, setInputText] = useState('');
  const [presetArea, setPresetArea] = useState(false);

  const presetTexts = useMemo(() => {
    if (!props.presetTexts) {
      return defaultPresetTexts;
    } else {
      return props.presetTexts;
    }
  }, [props.presetTexts]);

  const renderPresetArea = () => {
    const blocks = splitGroup(presetTexts).map((texts, index) => {
      return (
        <div className="unprefix-text-message-preset-block" key={index}>
          {texts.map((s: string, v: number) => (
            <span
              key={v}
              className="unprefix-text-message-preset-block-cell"
              onClick={() => {
                props.onSendMessage?.(s);
                setPresetArea(false);
              }}
            >
              {s}
            </span>
          ))}
        </div>
      );
    });
    return <div className="unprefix-text-message-preset">{blocks}</div>;
  };

  return (
    <div className="lk-message-sender-container">
      <div className="lk-message-sender-icon">
        <div className="call-icon send-message-icon"></div>
      </div>
      <Popover
        content={renderPresetArea()}
        open={presetArea}
        onOpenChange={newOpen => setPresetArea(newOpen)}
        destroyTooltipOnHide={true}
        overlayClassName={'unprefix-message-sender-preset-popover'}
      >
        <input
          type="text"
          maxLength={500}
          placeholder="Send to all"
          value={inputText}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            const tempText = event.currentTarget.value;
            if (tempText && presetArea) {
              setPresetArea(false);
            }
            if (!tempText && !presetArea) {
              setPresetArea(true);
            }
            setInputText(tempText);
          }}
          onKeyDown={(event: React.KeyboardEvent) => {
            // 过滤中文输入法的回车导致弹幕发送问题
            if (event.key !== 'Enter' || event.nativeEvent?.isComposing) {
              return;
            }
            if (inputText) {
              props.onSendMessage?.(inputText);
              setInputText('');
              // setPresetArea(true);
            }
          }}
          spellCheck={false}
        />
      </Popover>
    </div>
  );
};
