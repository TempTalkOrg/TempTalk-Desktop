import message from 'antd/lib/message';
import { ArgsProps, MessageType } from 'antd/lib/message/interface';
import {
  IconNoticeInfo,
  IconNoticeSuccess,
  IconNoticeError,
  IconNoticeWarning,
} from '../components/shared/icons';
import React from 'react';

const ICON_MAP: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  info: IconNoticeInfo,
  success: IconNoticeSuccess,
  error: IconNoticeError,
  warning: IconNoticeWarning,
};

let cancelMessage: MessageType | null = null;

const getIcon = (options?: Omit<ArgsProps, 'content'>) => {
  const { type } = options || {};
  if (!type) {
    return null;
  }
  const VALID_ICON_TYPES = ['success', 'error', 'warning', 'info'];

  if (VALID_ICON_TYPES.includes(type)) {
    return React.createElement(ICON_MAP[type], {
      className: `toast-icon toast-icon-${type}`,
    });
  }
  return null;
};

export const showToastAtCenter = (
  content: string,
  options?: Omit<ArgsProps, 'content'>
) => {
  cancelMessage?.();

  cancelMessage = message.open({
    icon: getIcon(options),
    content,
    className: 'universal-toast center-toast',
    ...options,
  });
};
