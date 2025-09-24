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

export function Brush(props: IconProps) {
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
        <path
          data-follow-stroke="currentColor"
          d="M3.281 16.094v-2.709a2.708 2.708 0 1 1 2.709 2.709H3.28Z"
          strokeWidth="1.67"
          strokeLinecap="round"
          strokeLinejoin="round"
          stroke={_stroke}
        />
        <path
          data-follow-stroke="currentColor"
          d="M15.469 3.906a10.833 10.833 0 0 0-8.667 6.906m8.667-6.906a10.833 10.833 0 0 1-6.906 8.667"
          strokeWidth="1.67"
          strokeLinecap="round"
          strokeLinejoin="round"
          stroke={_stroke}
        />
        <path
          data-follow-stroke="currentColor"
          d="M8.427 7.969a6.094 6.094 0 0 1 2.979 2.979"
          strokeWidth="1.67"
          strokeLinecap="round"
          strokeLinejoin="round"
          stroke={_stroke}
        />
      </g>
    </svg>
  );
}
