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

export function Rotate(props: IconProps) {
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
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeWidth="1.667"
          d="M17.436 8.79a4.242 4.242 0 0 0-3-5.196l-2.342-.628m0 0 1.286 2.227m-1.286-2.227 2.227-1.285M2.5 8.611A1.111 1.111 0 0 1 3.611 7.5h7.778A1.111 1.111 0 0 1 12.5 8.611v7.778a1.111 1.111 0 0 1-1.111 1.111H3.61a1.111 1.111 0 0 1-1.11-1.111V8.61Z"
          data-follow-stroke="currentColor"
          stroke={_stroke}
        />
      </g>
    </svg>
  );
}
