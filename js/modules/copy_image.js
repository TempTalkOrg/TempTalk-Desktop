const loadImage = require('blueimp-load-image');
const { nativeImage, clipboard } = require('electron');

exports.copyImage = async (attachment, loadAttachmentData) => {
  try {
    const attachmentWithData = await loadAttachmentData(attachment);

    const blob = new Blob([attachmentWithData.data], {
      type: attachmentWithData.contentType,
    });

    loadImage(
      blob,
      canvasOrError => {
        if (canvasOrError.type === 'error') {
          const error = new Error('copyImage: Failed to process image');
          error.cause = canvasOrError;
          return;
        }

        const canvas = canvasOrError;

        const dataURL = canvas.toDataURL();
        const image = nativeImage.createFromDataURL(dataURL);
        clipboard.writeImage(image);
      },
      {
        canvas: true,
      }
    );
  } catch (error) {
    log.error('copy image error occur:', error);
  }
};

exports.copyImageFile = async (imageFile, contentType) => {
  try {
    let blob;

    if (imageFile instanceof Blob) {
      blob = imageFile;
    } else {
      const data = await window.readFileBuffer(imageFile);
      blob = new Blob([data], { type: contentType });
    }

    loadImage(
      blob,
      canvasOrError => {
        if (canvasOrError.type === 'error') {
          const error = new Error('copyImage: Failed to process image');
          error.cause = canvasOrError;
          return;
        }

        const canvas = canvasOrError;

        const dataURL = canvas.toDataURL();
        const image = nativeImage.createFromDataURL(dataURL);
        clipboard.writeImage(image);
      },
      {
        canvas: true,
      }
    );
  } catch (error) {
    log.error('copy image error occur:', error);
  }
};
