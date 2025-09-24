import { useMemoizedFn } from 'ahooks';
import React from 'react';
import { LocalizerType } from '../../../types/Util';
import { Avatar } from '../../Avatar';

import { currentCall } from '../initCall';

export const useParticipantRenderer = (
  contactMap: Map<string, any>,
  i18n: LocalizerType
) => {
  const renderer = useMemoizedFn((participant, extraProps = { size: 100 }) => {
    if (participant) {
      let number = '';
      if (participant.identity) {
        number = participant.identity.split('.')[0];
      } else {
        if (participant.isLocal) {
          number = currentCall.ourNumber;
        }
      }
      const contact = contactMap.get(number);

      return (
        <Avatar
          i18n={i18n}
          conversationType="direct"
          size={extraProps.size}
          id={contact?.id}
          name={contact?.getDisplayName()}
          avatarPath={contact?.avatarPath}
          notShowStatus={true}
          noClickEvent={true}
        />
      );
    } else {
      return undefined;
    }
  });

  return renderer;
};
