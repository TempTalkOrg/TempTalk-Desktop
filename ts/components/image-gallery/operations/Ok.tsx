import React from 'react';
import { Icon } from './Icon';

export const Ok = ({ onClick }: { onClick: () => void }) => {
  return (
    <button className="toolbar-operation-button" onClick={onClick}>
      <Icon icon="ok" />
    </button>
  );
};
