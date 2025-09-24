import React from 'react';
import { Icon } from './Icon';

export const Save = ({ onClick }: { onClick: () => void }) => {
  return (
    <button className="toolbar-operation-button" onClick={onClick}>
      <Icon icon="save" />
    </button>
  );
};
