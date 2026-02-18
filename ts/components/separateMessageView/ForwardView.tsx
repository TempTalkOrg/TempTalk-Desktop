import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ForwardedMessageList } from '../conversation/ForwardedMessageList';
import { useMemoizedFn } from 'ahooks';
import { showToastAtCenter } from '../../util';
import { LocalizerType } from '../../types/Util';
import moment from 'moment';
import { IconBack } from '../shared/icons';

const tagVirtualIndex = (models: any[]) => {
  let prevModel = null;
  let prevDateTime = null;

  for (const model of models) {
    const timestamp = model.serverTimestamp;
    const dateTime = moment(timestamp).format('YYYYMMDD');

    if (!prevDateTime) {
      model.dateSeparator = false;
      prevDateTime = dateTime;
    } else {
      if (model.dateSeparator) {
        if (dateTime === prevDateTime) {
          model.dateSeparator = false;
        } else {
          prevDateTime = dateTime;
        }
      } else {
        if (dateTime !== prevDateTime) {
          model.dateSeparator = true;
          prevDateTime = dateTime;
        }
      }
    }

    let virtualIndex;
    if (model.getSource() === prevModel?.getSource() && !model.dateSeparator) {
      virtualIndex = prevModel.virtualIndex + 1;
    } else {
      virtualIndex = 0;
    }

    model.virtualIndex = virtualIndex;
    prevModel = model;
  }
};

export const ForwardView = ({
  i18n,
  data,
  onTitleChange,
}: {
  i18n: LocalizerType;
  data: { messageData: any; title: string; messageId: string };
  onTitleChange: (title: string) => void;
}) => {
  const [depth, setDepth] = useState(-1);
  const messageMapRef = useRef(new Map<number, any>());
  const [refreshCount, setRefreshCount] = useState(0);

  const onShowForwardedMessageList = useMemoizedFn(
    (message: any, title: string) => {
      const forwards = formatMessages(message.forwardedMessages);
      messageMapRef.current.set(depth + 1, { messages: forwards, title });
      setDepth(depth + 1);
    }
  );

  const formatMessages = useMemoizedFn((forawrdMessages: any[]) => {
    const formattedMessages = forawrdMessages.map((message: any) => {
      return {
        ...message,
        serverTimestamp: message.id,
        dateTimestamp: message.id,
        authorNoClickEvent: true,
        disableShowProfile: true,
        getSource: () => message.authorId,
        showForwardedMessageList: (title: string) =>
          onShowForwardedMessageList(message, title),
        onCopyImage: (attachment: any) => {
          (window as any).onCopyImage(attachment);
        },
        onDownload: (isDangerous: boolean) => {
          if (isDangerous) {
            showToastAtCenter(i18n('dangerousFileType'));
            return;
          }

          (window as any).downloadAttachment({
            attachment: message.attachments[0],
            document,
            timestamp: message.timestamp,
          });
        },
        onOpenFile: () => {
          if (message.attachments[0]) {
            (window as any).openFileDefault(
              message.attachments[0],
              data.messageId
            );
          }
        },
        onClickAttachment: (attachment: any) =>
          (window as any).showImageGallery({
            mediaFiles: JSON.stringify([
              {
                messageId: data.messageId,
                url: attachment.url,
                fileName: attachment.fileName || '',
                contentType: attachment.contentType,
                path: attachment.path,
              },
            ]),
            selectedIndex: 0,
          }),
      };
    });

    tagVirtualIndex(formattedMessages);

    return formattedMessages;
  });

  useEffect(() => {
    if (!data.messageData || !data.title) {
      return;
    }

    const formattedMessages = formatMessages(
      data.messageData?.forwardedMessages || []
    );
    messageMapRef.current.set(0, {
      messages: formattedMessages,
      title: data.title,
    });
    setDepth(0);
    setRefreshCount(prev => prev + 1);

    return () => {
      messageMapRef.current.clear();
    };
  }, [data]);

  const { messages, title: currentTitle } = useMemo(() => {
    return messageMapRef.current.get(depth) || { messages: [], title: '' };
  }, [depth, refreshCount]);

  useEffect(() => {
    if (currentTitle) {
      onTitleChange(currentTitle);
    }
  }, [currentTitle]);

  return (
    <>
      {depth > 0 ? (
        <div
          className="back-icon-wrapper"
          onClick={() => {
            setDepth(prev => Math.max(prev - 1, 0));
          }}
        >
          <IconBack
            className="back-icon"
            color="var(--dst-color-icon)"
            height={20}
            width={20}
          />
        </div>
      ) : null}
      <div className="separate-message-viewer-body-wrapper">
        {messages.length > 0 ? (
          <ForwardedMessageList
            key={`${refreshCount}-${depth}`}
            messages={messages}
            i18n={i18n}
            beforeRemove={() => {}}
          />
        ) : null}
      </div>
    </>
  );
};
