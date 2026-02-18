import React, { useEffect, useState } from 'react';
import { LocalizerType } from '../../types/Util';
import { useMemoizedFn } from 'ahooks';
import { LottieAnimation } from '../LottieAnimation';
import { Spin } from 'antd';
import { ForwardView } from './ForwardView';
import { TextView } from './TextView';

export const SeparateMessageView = ({ i18n }: { i18n: LocalizerType }) => {
  const [spinning, setSpinning] = useState(false);
  const [messageType, setMessageType] = useState<'forward' | 'text'>();
  const [data, setData] = useState<any>({
    messageData: null,
    title: '',
    messageId: '',
  });
  const [title, setTitle] = useState<string>('');

  const initData = useMemoizedFn(
    async (_, data: { messageId: string; title: string }) => {
      try {
        const { messageId, title } = data;
        setSpinning(true);
        const messageData = await (window as any).getMessageProps(messageId);
        setData({ messageData, title, messageId });
        // single forwarded message will be shown in text view
        if (messageData.forwardedMessages?.length > 1) {
          setMessageType('forward');
        } else {
          setMessageType('text');
        }
        setSpinning(false);
      } catch (error: any) {
        console.log('initData error', error.message);
      }
    }
  );

  useEffect(() => {
    const cleanup = (window as any).registerShowMessageInSeparateView(initData);

    return () => {
      cleanup();
    };
  }, []);

  return (
    <>
      <Spin
        rootClassName="separate-message-viewer-spin"
        spinning={spinning}
        fullscreen
        indicator={
          <LottieAnimation
            src={`../lotties/conversation-loading-${(window as any).getCurrentTheme()}.lottie`}
            style={{ height: 120 }}
          />
        }
      ></Spin>
      <div className="separate-message-viewer-title">
        <span
          className="apple-close"
          onClick={() => (window as any).closeWindow()}
        ></span>
        {title}
      </div>
      {messageType === 'forward' && (
        <ForwardView i18n={i18n} data={data} onTitleChange={setTitle} />
      )}
      {messageType === 'text' && (
        <TextView i18n={i18n} messageData={data.messageData} />
      )}
    </>
  );
};
