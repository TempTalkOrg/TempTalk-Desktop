import { useMemoizedFn } from 'ahooks';
import React, {
  createContext,
  useState,
  useContext,
  RefObject,
  Ref,
  useRef,
  useCallback,
} from 'react';
import { IHistoryStatus } from './IndividualImage';

import type { MosaicType } from '@cc-kit/react-screenshots';

// 定义 OperationContext 的类yar型
interface ImageGalleryContextType {
  scale: number;
  color: string;
  operation: string;
  history: IHistoryStatus;
  screenshotsRef: RefObject<any>;
  mosaicType: MosaicType;
  switchOperation: (operation: string) => void;
  undo: () => void;
  redo: () => void;
  invoke: (eventName: string) => void;
  onOperationChange: (operation: string) => void;
  onHistoryChange: (history: IHistoryStatus) => void;
  onColorChange: (color: string) => void;
  onMosaicTypeChange: (type: MosaicType) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  handleScaleChange: (scale: number) => void;
}

interface IImageGalleryContext {}

// 创建一个默认值为 null 的上下文（确保在没有 Provider 包裹的组件中使用时不会抛出错误）
const ImageGalleryContext = createContext<ImageGalleryContextType | undefined>(
  undefined
);

const ImageGalleryProvider: React.FC<IImageGalleryContext> = ({ children }) => {
  // 使用 useState 定义状态
  const [color, setColor] = useState<string>('#F84135');
  const [mosaicType, setMosaicType] = useState<MosaicType>('rectangle');
  const [history, setHistory] = useState<IHistoryStatus>({
    redoDisabled: true,
    undoDisabled: true,
  });
  const [operation, setOperation] = useState<string>('Rectangle');
  const [scale, setScale] = useState(1);
  const screenshotsRef: Ref<any> = useRef(null);

  const onColorChange = useMemoizedFn(color => {
    setColor(color);
    screenshotsRef?.current.updateColor(color);
  });

  const onMosaicTypeChange = useMemoizedFn(mosaicType => {
    setMosaicType(mosaicType);
    screenshotsRef?.current.updateMosaicType(mosaicType);
  });

  const switchOperation = (operation: string) => {
    setOperation(operation);
    screenshotsRef?.current.switchOperation(operation);
  };

  const undo = () => {
    screenshotsRef?.current.undo();
  };

  const redo = () => {
    screenshotsRef?.current.redo();
  };

  const invoke = (eventName: string) =>
    screenshotsRef.current?.invoke(eventName);

  const onOperationChange = useCallback((operation: string) => {
    if (!operation) return;
    setOperation(operation);
  }, []);

  const onHistoryChange = useCallback((status: IHistoryStatus) => {
    setHistory(status);
  }, []);

  const handleScaleChange = useMemoizedFn(scale => {
    setScale(scale);
  });

  const zoomOut = useMemoizedFn(() => {
    const delta = -0.1;
    const _scale = Math.max(1, parseFloat((scale + delta).toFixed(2)));
    screenshotsRef.current.updateScale(_scale);
  });

  const zoomIn = useMemoizedFn(() => {
    const delta = 0.1;
    const _scale = Math.max(1, parseFloat((scale + delta).toFixed(2)));
    screenshotsRef.current.updateScale(_scale);
  });

  const zoomReset = useMemoizedFn(() => {
    screenshotsRef.current.updateScale(1);
  });

  // 创建一个对象包含状态和设置状态的方法
  const contextValue = {
    scale,
    color,
    mosaicType,
    operation,
    history,
    screenshotsRef,
    undo,
    redo,
    invoke,
    onColorChange,
    onMosaicTypeChange,
    onOperationChange,
    onHistoryChange,
    switchOperation,
    handleScaleChange,
    zoomIn,
    zoomOut,
    zoomReset,
  };

  // 提供上下文值
  return (
    <ImageGalleryContext.Provider value={contextValue}>
      {children}
    </ImageGalleryContext.Provider>
  );
};

export const useImageGallery = (): ImageGalleryContextType => {
  return useContext(ImageGalleryContext)!;
};

export { ImageGalleryContext, ImageGalleryProvider };
