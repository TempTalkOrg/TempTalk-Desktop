import React from 'react';
import { useImageGallery } from '../context';
import { Icon } from './Icon';
import { CommonPopover } from './CommonPopover';
import { ScreenshotsMosaicType } from '@cc-kit/react-screenshots';

export const Mosaic = ({ onClick }: { onClick: () => void }) => {
  const { operation, mosaicType, onMosaicTypeChange } = useImageGallery();

  const checked = operation === 'Mosaic';

  let classNames = 'toolbar-operation-button';

  if (checked) {
    classNames += ' active';
  }

  return (
    <CommonPopover
      content={
        <ScreenshotsMosaicType
          value={mosaicType}
          onChange={onMosaicTypeChange}
        />
      }
      open={checked}
    >
      <button className={classNames} onClick={onClick}>
        <Icon icon="mosaic" size={20} />
      </button>
    </CommonPopover>
  );
};
