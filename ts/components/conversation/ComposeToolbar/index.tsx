import React from 'react';
import classNames from 'classnames';

import { LocalizerType } from '../../../types/Util';
import {
  MessageModeWrapper,
  MessageModeWrapperProps,
} from './MessageModeWrapper';

export interface ICommonProps {
  i18n: LocalizerType;
}

interface ComposeToolbarProps extends ICommonProps {
  toolbar: {
    active: boolean;
    visible: boolean;
  };
  messageMode: MessageModeWrapperProps;
}

export const ComposeToolbar = (props: ComposeToolbarProps) => {
  const { i18n, messageMode, toolbar } = props;
  return (
    <div
      className={classNames('compose-toolbar', {
        active: toolbar.active,
        hidden: !toolbar.visible,
      })}
    >
      <MessageModeWrapper {...messageMode} i18n={i18n} />
    </div>
  );
};
