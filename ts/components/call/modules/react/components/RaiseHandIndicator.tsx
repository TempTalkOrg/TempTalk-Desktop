import * as React from 'react';
import { useFeatureContext } from '../context/feature-context';
import { IconRaiseHand } from '../../../../shared/icons';

export const RaiseHandIndicator = ({ onClick }: { onClick: () => void }) => {
  const features = useFeatureContext();
  const raiseHandList = features?.raiseHandList ?? [];

  const text = React.useMemo(() => {
    if (raiseHandList.length === 0) {
      return '';
    }
    return `${raiseHandList.map(item => item.displayName).join(', ')}${
      raiseHandList.length > 3 ? '...' : ''
    }`;
  }, [raiseHandList]);

  if (raiseHandList.length === 0) {
    return null;
  }

  return (
    <div className="lk-raise-hand-indicator" onClick={onClick}>
      <div className="lk-raise-hand-indicator-icon">
        <IconRaiseHand className="call-icon raise-hand-icon" />
      </div>
      <div className="lk-raise-hand-indicator-text">{text}</div>
    </div>
  );
};
