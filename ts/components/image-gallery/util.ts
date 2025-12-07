import { ISize } from './IndividualImage';

export const getFitContainerScale = ({
  containerSize,
  imageSize,
}: {
  containerSize: ISize;
  imageSize: ISize;
}) => {
  const containerWidth = containerSize.width;
  const containerHeight = containerSize.height;
  const imgWidth = imageSize.width;
  const imgHeight = imageSize.height;

  if (imgHeight / imgWidth > containerHeight / containerWidth) {
    return containerHeight / imgHeight;
  } else {
    return containerWidth / imgWidth;
  }
};
