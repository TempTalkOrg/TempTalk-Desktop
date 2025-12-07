import React from 'react';
import { Tooltip } from 'antd';
import classNames from 'classnames';

import { LocalizerType } from '../../types/Util';

export enum MessageMode {
  NORMAL = 'normal',
  CONFIDENTIAL = 'confidential',
}
interface Props {
  i18n: LocalizerType;
  onChangeMessageMode: (mode: MessageMode) => void;
  mode: MessageMode;
}

export class MessageModeButton extends React.Component<Props> {
  public render() {
    const { i18n, mode, onChangeMessageMode } = this.props;
    return (
      <>
        <Tooltip
          mouseEnterDelay={1.5}
          overlayClassName={'antd-tooltip-cover'}
          placement="top"
          title={i18n('confidential-message-tooltip-title')}
        >
          <button
            onClick={() => {
              onChangeMessageMode(
                mode === MessageMode.CONFIDENTIAL
                  ? MessageMode.NORMAL
                  : MessageMode.CONFIDENTIAL
              );
            }}
            className={classNames(
              mode === MessageMode.CONFIDENTIAL
                ? 'open-confidential-message_click'
                : 'open-confidential-message'
            )}
          ></button>
        </Tooltip>
      </>
    );
  }
}
