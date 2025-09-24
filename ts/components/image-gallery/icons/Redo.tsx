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

export function Redo(props: IconProps) {
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
          data-follow-fill="currentColor"
          d="m17.985 9.17-4.744-5.085a1.047 1.047 0 0 0-.55-.314.993.993 0 0 0-.617.07 1.097 1.097 0 0 0-.478.429 1.25 1.25 0 0 0-.179.646v2.558c-2.142.181-4.191 1.021-5.91 2.423-1.718 1.401-3.035 3.306-3.795 5.491a.253.253 0 0 0-.005.142.235.235 0 0 0 .073.12.2.2 0 0 0 .248.014c2.837-1.883 6.068-2.952 9.389-3.106v2.526c0 .23.062.454.18.646.116.192.283.34.478.43a.99.99 0 0 0 .616.07c.208-.044.399-.153.55-.315l4.744-5.083c.101-.11.18-.239.236-.382.11-.29.11-.61 0-.9a1.18 1.18 0 0 0-.236-.38Z"
          fill={_fill}
        />
      </g>
    </svg>
  );
}
