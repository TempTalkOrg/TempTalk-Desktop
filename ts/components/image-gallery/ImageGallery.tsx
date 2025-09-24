import { ipcRenderer } from 'electron';
import React, { useEffect, useState } from 'react';
import { IndividualImage, IImageFile } from './IndividualImage';
import { useTheme } from './hooks/useTheme';

type ImageGalleryProps = {
  apis: any;
};

export const ImageGallery = (props: ImageGalleryProps) => {
  const { apis: ImageGalleryApis } = props;
  const [imageData, setImageData] = useState<{
    images: IImageFile[];
    index: number;
  }>({
    images: [],
    index: 0,
  });

  useTheme(ImageGalleryApis.globalWindow);

  useEffect(() => {
    let imageFiles = ImageGalleryApis.mediaFiles();
    let selectedIndex = ImageGalleryApis.selectedIndex();

    if (imageFiles) {
      let parsedImageFiles: IImageFile[] = JSON.parse(imageFiles);
      setImageData({
        images: parsedImageFiles,
        index: selectedIndex,
      });
    }

    // Listen for the event
    ipcRenderer.on('receive-images', (_, { mediaFiles, selectedIndex }) => {
      const parsedImageFiles: IImageFile[] = JSON.parse(mediaFiles);
      setImageData({
        images: parsedImageFiles,
        index: selectedIndex,
      });
    });

    ipcRenderer.on('close-image-window', () => {
      setImageData({
        images: [],
        index: 0,
      });
    });
  }, []);

  const handlePrevImage = () => {
    setImageData(prevState => {
      if (prevState.index === 0) {
        return prevState;
      }
      return {
        ...prevState,
        index: prevState.index - 1,
      };
    });
  };

  const handleNextImage = () => {
    setImageData(prevState => {
      if (prevState.index === prevState.images.length - 1) {
        return prevState;
      }
      return {
        ...prevState,
        index: prevState.index + 1,
      };
    });
  };

  const renderImage = () => {
    const { index, images } = imageData;
    if (images.length === 0) {
      return;
    }

    return (
      <IndividualImage
        handlePrevImage={handlePrevImage}
        handleNextImage={handleNextImage}
        image={images[index]}
        index={index}
        totalNumImage={images.length}
        apis={ImageGalleryApis}
      />
    );
  };

  return <>{renderImage()}</>;
};
