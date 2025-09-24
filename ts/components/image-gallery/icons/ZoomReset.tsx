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

export function ZoomReset(props: IconProps) {
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
      viewBox="0 0 21 20"
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
          clipPath="url(#12b2e0__a)"
          stroke={_stroke}
        >
          <path d="M3.833 6.667V5A1.667 1.667 0 0 1 5.5 3.333h1.667m-3.334 10V15A1.667 1.667 0 0 0 5.5 16.667h1.667m6.667-13.334H15.5A1.667 1.667 0 0 1 17.167 5v1.667m-3.333 10H15.5A1.667 1.667 0 0 0 17.167 15v-1.667M8 10a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0Z" />
        </g>
        <defs>
          <clipPath id="12b2e0__a">
            <path
              data-follow-fill="currentColor"
              d="M0 0h20v20H0z"
              transform="translate(.5)"
              fill={_fill}
            />
          </clipPath>
        </defs>
      </g>
    </svg>
  );
}
