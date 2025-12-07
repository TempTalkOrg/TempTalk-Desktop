import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import * as GoogleChrome from '../../util/GoogleChrome';
import { Screenshots, Mode } from '@cc-kit/react-screenshots';
import { ImageTitle } from './ImageTitle';
import { ImageGalleryProvider, useImageGallery } from './context';
import saveAs from 'file-saver';
import { useMemoizedFn, usePrevious } from 'ahooks';
import { PinchableImage, PinchableImageInstance } from '../PinchableImage';
import sanitize from 'sanitize-filename';
export interface IImageFile {
  url: string;
  caption: string;
  fileName: string;
  contentType: string;
  attachmentId: string;
}

interface IProps {
  image: IImageFile;
  handlePrevImage: () => void;
  handleNextImage: () => void;
  index: number;
  totalNumImage: number;
  apis: any;
}

export interface ISize {
  width: number;
  height: number;
}

function adjustImageSize({ width, height }: { width: number; height: number }) {
  const maxWidth = 900;
  const maxHeight = 600;

  if (width < maxWidth && height < maxHeight) return { width, height };

  // 计算图片的宽高比
  const imageRatio = width / height;

  // 初始设定图片的目标宽度为最大宽度，计算相应的高度
  let targetWidth = maxWidth;
  let targetHeight = targetWidth / imageRatio;

  // 如果计算出的高度超过了最大高度，则以最大高度为准，重新计算宽度
  if (targetHeight > maxHeight) {
    targetHeight = maxHeight;
    targetWidth = targetHeight * imageRatio;
  }

  return { width: targetWidth, height: targetHeight };
}

/**
 * 获取在线图片的大小。
 * @param {string} imageUrl 图片的URL地址。
 * @returns {Promise} 返回一个Promise对象，成功解析时返回图片的宽度和高度。
 */
function getImageSizeByUrl(imageUrl: string): Promise<ISize> {
  return new Promise((resolve, reject) => {
    let image = new Image();

    // 加载成功时操作
    image.onload = function () {
      resolve(adjustImageSize({ width: image.width, height: image.height }));
    };

    // 加载失败时操作
    image.onerror = function (e) {
      reject(new Error(`图片加载失败: ${e}`));
    };

    // 设置图片的src，开始加载图片
    image.src = imageUrl;

    // 处理可能的CORS策略问题，如果你加载的是跨域图片
    image.crossOrigin = 'anonymous';
  });
}

export interface IHistoryStatus {
  redoDisabled: boolean;
  undoDisabled: boolean;
}

export const IndividuralImageImpl: React.FC<
  IProps & { containerRef: React.RefObject<HTMLDivElement> }
> = props => {
  const {
    apis: ImageGalleryApis,
    image: {
      url: url,
      fileName: fileName,
      contentType: contentType,
      attachmentId,
    },
    handlePrevImage,
    handleNextImage,
    index,
    totalNumImage,
    containerRef,
  } = props;

  // const transformComponentRef = useRef<ReactZoomPanPinchRef | null>(null);
  const [rotation, setRotation] = useState(0);
  const [readonly, setReadonly] = useState(true);
  const [size, setSize] = useState<ISize>({ height: 0, width: 0 });
  const childRef = useRef<HTMLDivElement>(null);

  const {
    scale,
    screenshotsRef,
    imageSizeRef,
    onOperationChange,
    onHistoryChange,
    handleScaleChange,
  } = useImageGallery();
  const prevScale = usePrevious(scale);
  const wheelEventRef = useRef<WheelEvent>();

  const pinchableImageRef = useRef<PinchableImageInstance>(null);
  const editorRootRef = useRef<Element | null>();

  const handleControls = useMemoizedFn((control: string) => {
    switch (control) {
      case 'zoom-in':
        pinchableImageRef.current?.zoomIn();
        break;
      case 'zoom-out':
        pinchableImageRef.current?.zoomOut();
        break;
      case 'zoom-reset':
        pinchableImageRef.current?.zoomReset();
        break;
      case 'fit-window':
        pinchableImageRef.current?.fitWindow();
        break;
    }
  });

  // @ts-ignore
  const isImage = GoogleChrome.isImageTypeSupported(contentType);
  // @ts-ignore
  const isVideo = GoogleChrome.isVideoTypeSupported(contentType);

  useEffect(() => {
    if (isVideo) {
      return;
    }
    const initImageEditor = async () => {
      if (url) {
        const size = await getImageSizeByUrl(url);
        setSize(size);
        pinchableImageRef.current?.initSize(size);
        imageSizeRef.current = size;
      }
    };
    initImageEditor();
  }, [url, isVideo]);

  const copyImage = (blob: Blob) => {
    ImageGalleryApis.copyImageFile(blob, 'image/png');
  };

  const onSave = useMemoizedFn((blob: Blob) => {
    saveAs(blob, sanitize(fileName));
  });

  const onOk = (blob: Blob) => {
    copyImage(blob);
    window.close();
  };

  const onCancel = () => {
    window.close();
  };

  useEffect(() => {
    editorRootRef.current = document.querySelector('.root-wrapper');
  }, [readonly]);

  useLayoutEffect(() => {
    if (!containerRef.current || !childRef.current) return;

    const parentBounds = containerRef.current.getBoundingClientRect();
    const imgBounds = childRef.current.getBoundingClientRect();
    childRef.current.style.marginTop = `${Math.max(
      0,
      (parentBounds.height - imgBounds.height) / 2
    )}px`;
  }, [scale, childRef.current, containerRef.current]);

  useLayoutEffect(() => {
    if (readonly) return;
    if (prevScale === undefined) return;
    if (!containerRef.current || !editorRootRef.current) return;

    const delta = scale - prevScale;

    const imageBounds = editorRootRef.current.getBoundingClientRect();

    const xRate = wheelEventRef.current
      ? (wheelEventRef.current?.clientX + containerRef.current.scrollLeft) /
        imageBounds.width
      : 0.5;
    const yRate = wheelEventRef.current
      ? (wheelEventRef.current?.clientY - 52 + containerRef.current.scrollTop) /
        imageBounds.height
      : 0.5;

    containerRef.current.scrollLeft += size.width * delta * xRate;
    containerRef.current.scrollTop += size.width * delta * yRate;
  }, [size, scale, prevScale, readonly]);

  const handleKeyBoardEvent = useMemoizedFn((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      window.close();
      return;
    }
    if (event.key === 'ArrowLeft') {
      if (!readonly) {
        return;
      }
      handlePrevImage();
      return;
    }
    if (event.key === 'ArrowRight') {
      if (!readonly) {
        return;
      }
      handleNextImage();
      return;
    }
  });

  useEffect(() => {
    document.addEventListener('keydown', handleKeyBoardEvent);

    return () => {
      document.removeEventListener('keydown', handleKeyBoardEvent);
    };
  }, []);

  const renderContent = () => {
    if (isImage) {
      return readonly ? (
        <PinchableImage
          url={url}
          alt="img"
          ref={pinchableImageRef}
          rotation={rotation}
          style={{
            // height: size.height,
            // width: size.width,
            pointerEvents: 'auto',
          }}
          getContainer={() => containerRef.current}
        ></PinchableImage>
      ) : (
        <div ref={childRef}>
          <Screenshots
            mode={Mode.Editor}
            ref={screenshotsRef}
            scaleable={true}
            url={url}
            width={size.width}
            height={size.height}
            onSave={onSave}
            onOk={onOk}
            onCancel={onCancel}
            onHistoryChange={onHistoryChange}
            onOperationChange={onOperationChange}
            onScaleChange={(scale: number, event: WheelEvent) => {
              wheelEventRef.current = event;
              handleScaleChange(scale);
            }}
          />
        </div>
      );
    }

    if (isVideo) {
      return (
        <video
          role="button"
          controls={true}
          key={url}
          style={{
            outline: 'none',
            flexGrow: 1,
            flexShrink: 0,
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            position: 'relative',
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        >
          <source src={url} />
        </video>
      );
    }

    return <div>Unsupported File Type</div>;
  };

  return (
    <>
      <ImageTitle
        isImage={isImage}
        handlePrevImage={handlePrevImage}
        handleNextImage={handleNextImage}
        index={index}
        totalNumImage={totalNumImage}
        ImageGalleryApis={ImageGalleryApis}
        url={url}
        fileName={fileName}
        contentType={contentType}
        attachmentId={attachmentId}
        setRotation={setRotation}
        setReadonly={setReadonly}
        readonly={readonly}
        handleControls={handleControls}
      />
      <div className="image-container" ref={containerRef}>
        {renderContent()}
      </div>
    </>
  );
};

export const IndividualImage: React.FC<IProps> = props => {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <ImageGalleryProvider containerRef={containerRef}>
      <IndividuralImageImpl {...props} containerRef={containerRef} />
    </ImageGalleryProvider>
  );
};
