import React, { Fragment } from 'react';
import {
  Arrow,
  Brush,
  Cancel,
  Copy,
  Edit,
  Ellipse,
  Mosaic,
  NextPage,
  Ok,
  OpenExternal,
  PreviousPage,
  Rectangle,
  Redo,
  Rotate,
  Save,
  Text,
  Undo,
  ZoomIn,
  ZoomOut,
} from '../icons';
import { IconFitWindow, IconOriginalSize } from '../../shared/icons';

interface IIcon {
  color?: string;
  icon: string;
  size?: number;
  height?: number;
  width?: number;
}

const ICON_MAP: Record<string, (props: React.SVGProps<SVGSVGElement>) => any> =
  {
    'zoom-out': ZoomOut,
    'zoom-in': ZoomIn,
    rotate: Rotate,
    'fit-window': IconFitWindow,
    'original-size': IconOriginalSize,

    arrow: Arrow,
    brush: Brush,
    rectangle: Rectangle,
    ellipse: Ellipse,
    mosaic: Mosaic,
    text: Text,

    'previous-page': PreviousPage,
    'next-page': NextPage,

    redo: Redo,
    undo: Undo,

    copy: Copy,
    edit: Edit,
    'open-external': OpenExternal,

    ok: Ok,
    cancel: Cancel,
    save: Save,
  };

export const Icon = ({
  color = 'var(--dst-color-image-gallery-toolbar-icon)',
  icon,
  size = 20,
  height,
  width,
}: IIcon) => {
  const _width = width || size;
  const _height = height || size;

  const IconImpl = ICON_MAP[icon] ?? Fragment;

  return (
    <IconImpl style={{ color }} height={_height} width={_width}></IconImpl>
  );
};
