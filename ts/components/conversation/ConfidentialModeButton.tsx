import React from 'react';
import { Tooltip } from 'antd';
import classNames from 'classnames';

import { LocalizerType } from '../../types/Util';

interface Props {
  i18n: LocalizerType;
  onChangeConfidentialMode: (confidentialMode?: number) => void;
  confidentialMode: number;
}

export class ConfidentialModeButton extends React.Component<Props> {
  public render() {
    const { i18n, confidentialMode, onChangeConfidentialMode } = this.props;
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
              onChangeConfidentialMode(confidentialMode ? 0 : 1);
            }}
            className={classNames(
              confidentialMode
                ? 'open-confidential-message_click'
                : 'open-confidential-message'
            )}
          ></button>
        </Tooltip>
      </>
    );
  }
}
