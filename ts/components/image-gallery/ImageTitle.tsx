import React, { useMemo } from 'react';

import {
  Rectangle,
  Ellipse,
  Arrow,
  Text,
  Brush,
  Mosaic,
  Undo,
  Redo,
} from './operations';
import { saveAs } from 'file-saver';
import { useImageGallery } from './context';
import { Icon } from './operations/Icon';
import { Button, ConfigProvider } from 'antd';
import sanitize from 'sanitize-filename';

interface IEditorOption {
  imgSrc?: string;
  onClick?: any;
  component?: any;
  disabled?: boolean;
  height?: number;
  width?: number;
  icon?: string;
  size?: number;
  color?: string;
  style?: Record<string, any>;
  handleControls?: (operation: string) => void;
}

export const ImageTitle: React.FC<any> = props => {
  const {
    handlePrevImage,
    handleNextImage,
    index,
    totalNumImage,
    isImage,
    ImageGalleryApis,
    url,
    fileName,
    contentType,
    attachmentId,
    setRotation,
    setReadonly,
    readonly,
    handleControls,
  } = props;

  const { i18n } = ImageGalleryApis;
  const {
    history,
    switchOperation,
    undo,
    redo,
    invoke,
    zoomIn,
    zoomOut,
    zoomReset,
  } = useImageGallery();

  // On-click icon functions
  const downloadImage = () => {
    saveAs(url, sanitize(fileName)); // Put your image url here.
  };

  const copyImage = () => {
    ImageGalleryApis.copyImageFile(url, contentType);
  };

  const openFileExternal = () => {
    ImageGalleryApis.openFileDefault(url, fileName, contentType, attachmentId);
  };

  const onZoomIn = () => {
    handleControls?.('zoom-in');
  };

  const onZoomOut = () => {
    handleControls?.('zoom-out');
  };

  const onReset = () => {
    handleControls?.('zoom-reset');
    setRotation(0);
  };

  const onRotate = () => {
    (setRotation as React.Dispatch<React.SetStateAction<number>>)(
      prevState => prevState - 90
    );
  };

  const startEdit = () => {
    onReset();
    setReadonly(false);
  };

  const EDITOR_OPTIONS: IEditorOption[] = useMemo(() => {
    const READ_ONLY_MENU = [
      {
        imgSrc: 'previous-page.svg',
        onClick: () => {
          handlePrevImage();
          onReset();
        },
        disabled: index == 0,
        icon: 'previous-page',
      },
      {
        component: (
          <div
            key={'placeholder key 1'}
            style={{ width: 86, fontSize: 12, margin: '0 -24px' }}
          >
            {index + 1} of {totalNumImage}
          </div>
        ),
      },
      {
        imgSrc: 'next-page.svg',
        onClick: () => {
          handleNextImage();
          onReset();
        },
        disabled: index >= totalNumImage - 1,
        icon: 'next-page',
      },
      { imgSrc: isImage ? 'divider.png' : '', height: 24, width: 1 },
      {
        imgSrc: isImage ? 'zoom-out.svg' : '',
        onClick: onZoomOut,
        icon: 'zoom-out',
      },
      {
        imgSrc: isImage ? 'zoom-in.svg' : '',
        onClick: onZoomIn,
        icon: 'zoom-in',
      },
      {
        imgSrc: isImage ? 'zoom-reset.svg' : '',
        onClick: onReset,
        icon: 'zoom-reset',
      },
      { imgSrc: 'divider.png', height: 24, width: 1 },
      {
        imgSrc: isImage ? 'rotate.svg' : '',
        onClick: onRotate,
        icon: 'rotate',
      },
      {
        imgSrc: isImage ? 'copy.svg' : '',
        onClick: copyImage,
        icon: 'copy',
      },
      { imgSrc: 'save.svg', onClick: downloadImage, icon: 'save' },
      // { imgSrc: 'forward.png', onClick: onForwardImage },
      {
        imgSrc: 'open-external.svg',
        onClick: openFileExternal,
        icon: 'open-external',
      },
      {
        imgSrc: isImage ? 'edit.svg' : '',
        onClick: startEdit,
        icon: 'edit',
      },
    ];

    const EDIT_MENU: IEditorOption[] = [
      {
        component: (
          <Rectangle
            key="Rectangle"
            onClick={() => switchOperation('Rectangle')}
          />
        ),
      },
      {
        component: (
          <Ellipse key="Ellipse" onClick={() => switchOperation('Ellipse')} />
        ),
      },
      {
        component: (
          <Arrow key="Arrow" onClick={() => switchOperation('Arrow')} />
        ),
      },
      { imgSrc: 'divider.png', height: 24, width: 1 },
      {
        component: <Text key="Text" onClick={() => switchOperation('Text')} />,
      },
      {
        component: (
          <Brush key="Brush" onClick={() => switchOperation('Brush')} />
        ),
      },
      {
        component: (
          <Mosaic key="Mosaic" onClick={() => switchOperation('Mosaic')} />
        ),
      },
      { imgSrc: 'divider.png', height: 24, width: 1 },
      {
        component: (
          <Undo
            key="Undo"
            disabled={history.undoDisabled}
            onClick={() => undo()}
          />
        ),
      },
      {
        component: (
          <Redo
            key="Redo"
            disabled={history.redoDisabled}
            onClick={() => redo()}
          />
        ),
      },
      { imgSrc: 'divider.png', height: 24, width: 1 },
      {
        imgSrc: isImage ? 'zoom-out' : '',
        icon: 'zoom-out',
        onClick: () => zoomOut(),
      },
      {
        imgSrc: isImage ? 'zoom-in' : '',
        icon: 'zoom-in',
        onClick: () => zoomIn(),
      },
      {
        imgSrc: isImage ? 'zoom-reset' : '',
        icon: 'zoom-reset',
        onClick: () => zoomReset(),
      },

      { imgSrc: 'divider.png', height: 24, width: 1 },
      { imgSrc: 'save.svg', icon: 'save', onClick: () => invoke('onSave') },
      // { component: <Cancel key="Cancel" onClick={() => invoke('onCancel')} /> },
      {
        component: (
          <ConfigProvider
            theme={{
              token: {
                colorPrimary: '#056FFA',
                borderRadius: 4,
                fontSize: 12,
              },
            }}
            key="ok"
          >
            <Button
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                width: 183,
                height: 24,
                padding: '4px 8px',
              }}
              key="Ok"
              type="primary"
              onClick={() => invoke('onOk')}
            >
              {i18n('imageEditorOkButton')}
            </Button>
          </ConfigProvider>
        ),
      },
    ];

    return readonly ? READ_ONLY_MENU : EDIT_MENU;
  }, [readonly, history, index, isImage, totalNumImage]);

  return (
    <div
      className={'drag-title'}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 999,
        width: '100%',
        backgroundColor: 'var(--dst-color-image-gallery-toolbar)',
        height: 52,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        // maxWidth: 625
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: readonly ? 20 : 16,
          width: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          margin: '20 auto 0',
          maxWidth: 625,
        }}
      >
        {EDITOR_OPTIONS.map((option, index) => {
          if (option.imgSrc) {
            return (
              <button
                key={index}
                className={'editor-icon'}
                onClick={option.onClick}
                disabled={option.disabled}
                style={{ ...(option.style ?? {}) }}
              >
                {option.icon ? (
                  <Icon
                    icon={option.icon}
                    height={20}
                    width={20}
                    color={option.color}
                  />
                ) : (
                  <img
                    alt={''}
                    height={option.height ?? 24}
                    width={option.width ?? 24}
                    src={option.imgSrc}
                  />
                )}
              </button>
            );
          }
          if (option.component) {
            return option.component;
          }
        })}
      </div>
    </div>
  );
};
