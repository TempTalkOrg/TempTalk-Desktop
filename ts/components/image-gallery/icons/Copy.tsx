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

export function Copy(props: IconProps) {
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
          clipPath="url(#12b2d0__a)"
          stroke={_stroke}
        >
          <path d="M5.833 8.056a2.222 2.222 0 0 1 2.223-2.223h7.222A2.223 2.223 0 0 1 17.5 8.056v7.222a2.223 2.223 0 0 1-2.222 2.222H8.056a2.222 2.222 0 0 1-2.222-2.223V8.056Z" />
          <path d="M3.343 13.947A1.671 1.671 0 0 1 2.5 12.5V4.167c0-.917.75-1.667 1.667-1.667H12.5c.625 0 .965.32 1.25.833" />
        </g>
        <defs>
          <clipPath id="12b2d0__a">
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
