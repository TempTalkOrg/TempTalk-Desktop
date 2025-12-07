import { ConfigProvider, Input } from 'antd';
import React, { useEffect, KeyboardEvent, useRef } from 'react';
import type { GetRef } from 'antd';

type TextAreaProps = {
  content: string;
  className?: string;
  onComplete: (text: string | undefined) => void;
  maxLength: number;
};

type TextAreaRef = GetRef<typeof Input.TextArea>;

export const AutoSizeInput = (props: TextAreaProps) => {
  const textareaRef = useRef<TextAreaRef>(null);

  useEffect(() => {
    const textareaNode = textareaRef.current?.resizableTextArea?.textArea;
    textareaNode?.focus();
    textareaNode?.setSelectionRange(-1, -1);
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e?.key === 'Enter' || e?.key === 'Escape') {
      const textareaNode = textareaRef.current?.resizableTextArea?.textArea;
      props?.onComplete(textareaNode?.value);
    }
  };

  const onBlur = () => {
    const textareaNode = textareaRef.current?.resizableTextArea?.textArea;
    props?.onComplete(textareaNode?.value);
  };

  return (
    <ConfigProvider
      theme={{
        components: {
          Input: {
            motionDurationSlow: '0s',
            lineHeight: 1.25,
          },
        },
      }}
    >
      <Input.TextArea
        className={props.className}
        ref={textareaRef}
        defaultValue={props.content}
        maxLength={props.maxLength}
        spellCheck={false}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        autoSize={{ minRows: 1, maxRows: 2 }}
        size="small"
      />
    </ConfigProvider>
  );
};
