import React from 'react';
import { Tooltip } from 'antd';
import type { TooltipProps } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import classNames from 'classnames';

export const CommonTooltip = ({ children, ...rest }: TooltipProps) => {
  const childNode = children || (
    <InfoCircleOutlined className="common-tooltip-default-icon" />
  );

  return (
    <Tooltip
      {...rest}
      rootClassName={classNames([
        'universal-tooltip common-tooltip',
        rest.rootClassName,
      ])}
    >
      {childNode}
    </Tooltip>
  );
};
