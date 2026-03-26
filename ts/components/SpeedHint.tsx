import React from 'react';
import { IconSlowDown, IconSpeedUp } from './shared/icons';
import { Tooltip } from 'antd';
import { LocalizerType } from '../types/Util';
import { useMemoizedFn } from 'ahooks';

type PropTypes = {
  i18n: LocalizerType;
  onSendSpeedHint: (speed: 'slower' | 'faster') => void;
};

export const SpeedHint = ({ i18n, onSendSpeedHint }: PropTypes) => {
  const handleClick = useMemoizedFn((speed: 'slower' | 'faster') => {
    onSendSpeedHint(speed);
  });

  return (
    <div className="speed-hint">
      <Tooltip
        title={i18n('speedHint.slower')}
        placement="bottom"
        zIndex={1000}
      >
        <div
          className="speed-hint-slower"
          onClick={() => handleClick('slower')}
        >
          <IconSlowDown className="speed-hint-icon" height={20} width={20} />
        </div>
      </Tooltip>
      <Tooltip
        title={i18n('speedHint.faster')}
        placement="bottom"
        zIndex={1000}
      >
        <div
          className="speed-hint-faster"
          onClick={() => handleClick('faster')}
        >
          <IconSpeedUp className="speed-hint-icon" height={20} width={20} />
        </div>
      </Tooltip>
    </div>
  );
};
