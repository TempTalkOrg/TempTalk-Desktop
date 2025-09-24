import React, { useEffect, useRef } from 'react';
interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: string | number;
  width?: string | number;
  height?: string | number;
  spin?: boolean;
  rtl?: boolean;
  color?: string;
  fill?: string;
  stroke?: string;
}

export function Edit(props: IconProps) {
  const root = useRef<SVGSVGElement>(null);
  const {
    size = 20,
    width,
    height,
    spin,
    rtl,
    color,
    fill,
    stroke,
    className,
    ...rest
  } = props;
  const _width = width || size;
  const _height = height || size;
  const _stroke = stroke || color;
  const _fill = fill || color;
  useEffect(() => {
    if (!_fill) {
      (root.current as SVGSVGElement)
        ?.querySelectorAll('[data-follow-fill]')
        .forEach(item => {
          item.setAttribute(
            'fill',
            item.getAttribute('data-follow-fill') || ''
          );
        });
    }
    if (!_stroke) {
      (root.current as SVGSVGElement)
        ?.querySelectorAll('[data-follow-stroke]')
        .forEach(item => {
          item.setAttribute(
            'stroke',
            item.getAttribute('data-follow-stroke') || ''
          );
        });
    }
  }, [stroke, color, fill]);
  return (
    <svg
      ref={root}
      width={_width}
      height={_height}
      viewBox="0 0 20 20"
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      role="presentation"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <g>
        <g
          data-follow-stroke="currentColor"
          strokeWidth="1.67"
          strokeLinecap="round"
          strokeLinejoin="round"
          clipPath="url(#12b2d1__a)"
          stroke={_stroke}
        >
          <path d="M5.833 5.833H5A1.667 1.667 0 0 0 3.333 7.5V15A1.667 1.667 0 0 0 5 16.667h7.5A1.667 1.667 0 0 0 14.167 15v-.833" />
          <path d="M16.988 5.488a1.75 1.75 0 0 0-2.476-2.475L7.5 10v2.5H10l6.988-7.012Zm-3.654-1.321 2.5 2.5" />
        </g>
        <defs>
          <clipPath id="12b2d1__a">
            <path
              data-follow-fill="currentColor"
              d="M0 0h20v20H0z"
              fill={_fill}
            />
          </clipPath>
        </defs>
      </g>
    </svg>
  );
}
