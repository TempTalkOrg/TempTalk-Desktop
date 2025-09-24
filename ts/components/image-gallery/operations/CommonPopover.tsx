import React from 'react';
import { Popover, PopoverProps } from 'antd';

export const CommonPopover = ({ open, ...props }: PopoverProps) => {
  return (
    <Popover
      open={open}
      placement="bottom"
      overlayClassName="toolbar-operation-popover-overlay"
      align={{
        offset: [0, 8],
      }}
      {...props}
    >
      {props.children}
    </Popover>
  );
};
