import loadImage from 'blueimp-load-image';

const COLORS = {
  red: '#cc163d',
  deep_orange: '#c73800',
  brown: '#746c53',
  pink: '#a23474',
  purple: '#862caf',
  indigo: '#5951c8',
  blue: '#336ba3',
  teal: '#067589',
  green: '#3b7845',
  light_green: '#895d66',
  blue_grey: '#607d8b',
  grey: '#6b6b78',
} as const;

const SVG_NS = 'http://www.w3.org/2000/svg';
const AVATAR_SIZE = 100;
const AVATAR_CENTER = AVATAR_SIZE / 2;
const CIRCLE_RADIUS = 40;
const FONT_SIZE = 24;

interface AvatarProps {
  content: string;
  color: keyof typeof COLORS;
}

function createSVGElement(
  tag: string,
  attributes: Record<string, string>
): SVGElement {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
}

function createAvatarSVG(avatar: AvatarProps): string {
  const svg = createSVGElement('svg', {
    width: String(AVATAR_SIZE),
    height: String(AVATAR_SIZE),
    xmlns: SVG_NS,
  });

  const circle = createSVGElement('circle', {
    cx: String(AVATAR_CENTER),
    cy: String(AVATAR_CENTER),
    r: String(CIRCLE_RADIUS),
    fill: COLORS[avatar.color],
  });
  svg.appendChild(circle);

  const text = createSVGElement('text', {
    'text-anchor': 'middle',
    fill: 'white',
    'font-family': 'sans-serif',
    'font-size': `${FONT_SIZE}px`,
    x: String(AVATAR_CENTER),
    y: String(AVATAR_CENTER),
    'baseline-shift': '-8px',
  });
  text.textContent = avatar.content;
  svg.appendChild(text);

  return svg.outerHTML;
}

function svgToDataUrl(svgString: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);

    const img = document.createElement('img');
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG image'));
    };

    img.onload = () => {
      try {
        const canvas = loadImage.scale(img, {
          canvas: true,
          maxWidth: AVATAR_SIZE,
          maxHeight: AVATAR_SIZE,
        });

        const dataUrl = canvas.toDataURL('image/png');
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };

    img.src = url;
  });
}

export const newIdenticonSvgDataUrl = async (
  avatar: AvatarProps
): Promise<string | null> => {
  try {
    const svgString = createAvatarSVG(avatar);
    return await svgToDataUrl(svgString);
  } catch (error) {
    console.log('getDefaultAvatarDataUrl error', error);
    return null;
  }
};
