import React from 'react';
import { CommonPopover } from './CommonPopover';
import { ScreenshotsColor } from '@cc-kit/react-screenshots';
import { useImageGallery } from '../context';
import { Icon } from './Icon';

export const Rectangle = ({ onClick }: { onClick: () => void }) => {
  const { operation, color, onColorChange } = useImageGallery();

  const checked = operation === 'Rectangle';

  let classNames = 'toolbar-operation-button';

  if (checked) {
    classNames += ' active';
  }

  return (
    <CommonPopover
      content={<ScreenshotsColor value={color} onChange={onColorChange} />}
      open={checked}
    >
      <button className={classNames} onClick={onClick}>
        <Icon size={20} icon="rectangle" />
      </button>
    </CommonPopover>
  );
};
