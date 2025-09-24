import React from 'react';

interface IconWrapperProps {
  style?: React.CSSProperties;
  className?: string;
  borderRadiusSize?: BorderRadiusSize;
  // Add any other custom props here
  [key: string]: any;
}

export enum BorderRadiusSize {
  SMALL = 4,
  NORMAL = 8,
}

export const IconWrapper: React.FC<IconWrapperProps> = ({
  children,
  className,
  borderRadiusSize = BorderRadiusSize.NORMAL,
  ...extra
}) => {
  return (
    <div
      className={`universal-icon-wrapper ${className}`}
      {...extra}
      style={{ borderRadius: borderRadiusSize, ...extra.style }}
    >
      {children}
    </div>
  );
};
