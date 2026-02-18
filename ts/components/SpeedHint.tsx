import React from 'react';
import { IconDoubleArrowLeft, IconDoubleArrowRight } from './shared/icons';
import { BorderRadiusSize, IconWrapper } from './shared/IconWrapper';
import { Tooltip } from 'antd';
import { LocalizerType } from '../types/Util';
import { useMemoizedFn } from 'ahooks';
import { Avatar } from './Avatar';
import { Contact } from './call/hooks/useInitials';

type PropTypes = {
  i18n: LocalizerType;
  speedHints: { slower: Contact | null; faster: Contact | null };
  onSendSpeedHint: (speed: 'slower' | 'faster') => void;
};

export const SpeedHint = ({ i18n, speedHints, onSendSpeedHint }: PropTypes) => {
  const handleClick = useMemoizedFn((speed: 'slower' | 'faster') => {
    onSendSpeedHint(speed);
  });

  return (
    <>
      <div className="content-divider"></div>
      <div className="speed-hint">
        <Tooltip title={i18n('speedHint.slower')} placement="bottom">
          <IconWrapper
            className="speed-hint-icon-wrapper"
            borderRadiusSize={BorderRadiusSize.SMALL}
            onClick={() => handleClick('slower')}
          >
            <IconDoubleArrowLeft className="speed-hint-icon" />
          </IconWrapper>
        </Tooltip>
        <Tooltip title={i18n('speedHint.faster')} placement="bottom">
          <IconWrapper
            className="speed-hint-icon-wrapper"
            borderRadiusSize={BorderRadiusSize.SMALL}
            onClick={() => handleClick('faster')}
          >
            <IconDoubleArrowRight className="speed-hint-icon" />
          </IconWrapper>
        </Tooltip>
        {!!speedHints.faster || !!speedHints.slower ? (
          <div className="speed-hint-info">
            {speedHints.faster && (
              <div className="speed-hint-info-item">
                <Avatar
                  conversationType="direct"
                  i18n={i18n}
                  avatarPath={speedHints.faster.avatarPath}
                  size={20}
                  noClickEvent={true}
                  className="speed-hint-info-item-avatar"
                />
                <span className="speed-hint-info-item-text">
                  :{i18n('speedHint.faster')}
                </span>
              </div>
            )}
            {speedHints.slower && (
              <div className="speed-hint-info-item">
                <Avatar
                  conversationType="direct"
                  i18n={i18n}
                  avatarPath={speedHints.slower.avatarPath}
                  size={20}
                  noClickEvent={true}
                  className="speed-hint-info-item-avatar"
                />
                <span className="speed-hint-info-item-text">
                  :{i18n('speedHint.slower')}
                </span>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
};
