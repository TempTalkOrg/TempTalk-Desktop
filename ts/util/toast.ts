import message from 'antd/lib/message';
import { ArgsProps, MessageType } from 'antd/lib/message/interface';

let cancelMessage: MessageType | null = null;

export const showToastAtCenter = (
  content: string,
  options?: Omit<ArgsProps, 'content'>
) => {
  cancelMessage?.();

  cancelMessage = message.open({
    content,
    className: 'universal-toast center-toast',
    ...options,
  });
};
