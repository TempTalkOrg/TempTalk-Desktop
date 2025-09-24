import { useMemoizedFn } from 'ahooks';
import React, { useEffect, useRef, useState } from 'react';
import { LocalizerType } from '../../types/Util';
import {
  MessageBody,
  Props as MessageBodyProps,
} from '../conversation/MessageBody';

interface DataType extends MessageBodyProps {
  id: string;
}

export const SeparateMessageView = ({ i18n }: { i18n: LocalizerType }) => {
  const [messageData, setMessageData] = useState<DataType>();
  const messageIdRef = useRef<string | null>(null);
  const readRef = useRef<boolean>(false);
  const [isMouseOver, setIsMouseOver] = useState<boolean>(false);

  const handleUpdateMessage = useMemoizedFn((_, data: DataType) => {
    setMessageData(data);
    messageIdRef.current = data.id;
    readRef.current = false;
  });

  const handleMouseEnter = useMemoizedFn(() => {
    setIsMouseOver(true);
    if (readRef.current === false) {
      (window as any).readConfidentialMessage(messageIdRef.current);
      readRef.current = true;
    }
  });

  const handleMouseLeave = useMemoizedFn(() => {
    setIsMouseOver(false);
  });

  useEffect(() => {
    const cleanup = (window as any).registerShowMessageInSeparateView(
      handleUpdateMessage
    );

    return () => {
      cleanup();
    };
  }, []);

  return (
    <>
      <div className="separate-message-viewer-title"></div>
      <div className="separate-message-viewer-body-wrapper">
        <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
          <div className="module-message__text">
            {messageData && (
              <MessageBody
                isMouseOver={isMouseOver}
                text={messageData.text}
                i18n={i18n}
                isConfidentialMessage={true}
                mentions={messageData.mentions}
                showOnMouseOver={true}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};
