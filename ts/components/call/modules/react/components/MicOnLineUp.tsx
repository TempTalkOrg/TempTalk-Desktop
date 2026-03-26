import { useAtomValue } from 'jotai';
import { deferredSpeakingParticipantAtom } from '../../../atoms/deferredSpeakingParticipantAtom';
import { useParticipants } from '../hooks';
import { useFeatureContext } from '../context';
import { remove } from 'lodash';
import { Tooltip } from 'antd';
import classNames from 'classnames';
import React from 'react';

export const MicOnLineUp = () => {
  const participants = useParticipants();
  const deferredSpeakingParticipant = useAtomValue(
    deferredSpeakingParticipantAtom
  );

  const featureFlags = useFeatureContext();

  const i18n = featureFlags?.i18n;
  const renderParticipantPlaceholder =
    featureFlags?.renderParticipantPlaceholder;
  const nameFormatter = featureFlags?.nameFormatter;

  const lineUpForDisplay = remove(
    participants.filter(participant => participant.isMicrophoneEnabled),
    p => p !== deferredSpeakingParticipant
  ).slice(0, 3);

  if (!lineUpForDisplay.length) {
    return null;
  }

  return (
    <Tooltip
      trigger="hover"
      placement="top"
      overlayClassName="mic-on-line-up-tooltip"
      align={{
        offset: [12, -14],
      }}
      title={
        <div className="mic-on-line-up-tooltip-content">
          <p className="mic-on-line-up-names">
            <span className="mic-on-line-up-names-prefix">
              {i18n?.('micOnLineUpPrefix')}
            </span>
            <span className="mic-on-line-up-names-content">
              {lineUpForDisplay
                .map(participant => nameFormatter?.(participant) || '')
                .join(',')}
            </span>
          </p>
        </div>
      }
    >
      <div className="mic-on-line-up">
        <div className="mic-on-line-up-divider"></div>
        <div
          className={classNames([
            'mic-on-line-up-participants',
            {
              'is-multi-participants': lineUpForDisplay.length > 1,
            },
            `participant-count-${lineUpForDisplay.length}`,
          ])}
        >
          {lineUpForDisplay.map((participant, index) => (
            <div
              key={participant.identity}
              className="mic-on-line-up-participant"
              style={{
                zIndex: lineUpForDisplay.length - index,
              }}
            >
              {renderParticipantPlaceholder?.(participant, { size: 16 }) ??
                null}
            </div>
          ))}
        </div>
      </div>
    </Tooltip>
  );
};
