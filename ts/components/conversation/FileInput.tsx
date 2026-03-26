import React, { useEffect, useState } from 'react';
import { LocalizerType } from '../../types/Util';
import { useMemoizedFn, usePrevious } from 'ahooks';
import {
  arrayBufferToObjectURL,
  isFileDangerous,
  showToastAtCenter,
} from '../../util';
import filesize from 'filesize';
import { AttachmentList } from './AttachmentList';
import { IMAGE_JPEG, IMAGE_PNG } from '../../types/MIME';
import { without } from 'lodash';
import { AttachmentType } from '../../types/Attachment';
import loadImage from 'blueimp-load-image';
import { canvasToBlob } from '../../util/canvasToBlob';
import { tryGetAttachmentsFromHtml } from '../../util/clipboard';
import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from '../../util/GoogleChrome';
import { SignalService } from '../../protobuf';

interface Props {
  i18n: LocalizerType;
  onClickAttachment: (attachment: AttachmentType) => void;
  onAddAttachment: () => void;
  onClose: () => void;
  newFile: File | null;
  newAttachment: AttachmentType;
  newClipboardEvent: ClipboardEvent | null;
  VisualAttachment: any;
  onAttachmentsChange: (attachments: Array<AttachmentType>) => void;
  resetCount: number;
}

const mainWindow: any = window;

export const readAttachment = <T extends Pick<AttachmentType, 'file'>>(
  attachment: T
): Promise<T & { data?: ArrayBuffer; size?: number }> => {
  return new Promise((resolve, reject) => {
    if (!attachment.file) {
      resolve(attachment);
      return;
    }

    const FR = new FileReader();
    FR.onload = (e: any) => {
      const data = e.target.result;
      resolve({
        ...attachment,
        data,
        size: data.byteLength,
      });
    };
    FR.onerror = reject;
    FR.onabort = reject;
    FR.readAsArrayBuffer(attachment.file);
  });
};

export const autoScale = <
  T extends Pick<AttachmentType, 'contentType' | 'file'>,
>(
  attachment: T
): Promise<T> => {
  const { contentType, file } = attachment;

  if (!file) {
    return Promise.resolve(attachment);
  }

  if (
    contentType.split('/')[0] !== 'image' ||
    contentType === 'image/tiff' ||
    contentType === 'image/heic'
  ) {
    // nothing to do
    return Promise.resolve(attachment);
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = document.createElement('img');
    img.onerror = reject;
    img.onload = async () => {
      URL.revokeObjectURL(url);

      const maxSize = 6000 * 1024;
      const maxHeight = 4096;
      const maxWidth = 4096;
      if (
        img.naturalWidth <= maxWidth &&
        img.naturalHeight <= maxHeight &&
        file.size <= maxSize
      ) {
        resolve(attachment);
        return;
      }

      const gifMaxSize = 25000 * 1024;
      if (file.type === 'image/gif' && file.size <= gifMaxSize) {
        resolve(attachment);
        return;
      }

      if (file.type === 'image/gif') {
        reject(new Error('GIF is too large'));
        return;
      }

      const canvas = loadImage.scale(img, {
        canvas: true,
        maxWidth,
        maxHeight,
      });

      let quality = 0.95;
      let i = 4;
      let blob;
      do {
        i -= 1;
        blob = await canvasToBlob(canvas, IMAGE_JPEG, quality);

        quality = (quality * maxSize) / blob.size;
        // NOTE: During testing with a large image, we observed the
        // `quality` value being > 1. Should we clamp it to [0.5, 1.0]?
        // See: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob#Syntax
        if (quality < 0.5) {
          quality = 0.5;
        }
      } while (i > 0 && blob.size > maxSize);

      resolve({
        ...attachment,
        file: blob,
      });
    };
    img.src = url;
  });
};

export const FileInput = (props: Props) => {
  const {
    i18n,
    onClickAttachment,
    onAddAttachment,
    onClose,
    newFile,
    newAttachment,
    newClipboardEvent,
    VisualAttachment,
    onAttachmentsChange,
    resetCount,
  } = props;

  const [attachments, setAttachments] = useState<Array<AttachmentType>>([]);

  const getFile = useMemoizedFn(async (attachment: AttachmentType) => {
    if (!attachment) {
      return Promise.resolve();
    }

    const attachmentFlags = attachment.isVoiceNote
      ? SignalService.AttachmentPointer.Flags.VOICE_MESSAGE
      : null;

    const scaled = await autoScale(attachment);
    const fileRead = await readAttachment(scaled);
    return {
      ...fileRead,
      url: '',
      videoUrl: undefined,
      flags: attachmentFlags || null,
    } as AttachmentType;
  });

  const addAttachment = useMemoizedFn((attachment: AttachmentType) => {
    if (attachment.isVoiceNote && attachments.length > 0) {
      throw new Error('A voice note cannot be sent with other attachments');
    }
    attachment.getFile = async () => await getFile(attachment);
    setAttachments([...attachments, attachment]);
  });

  const onCloseAttachment = useMemoizedFn((attachment: AttachmentType) => {
    setAttachments(prev => without(prev, attachment));
  });

  const onNewFileChange = useMemoizedFn(async file => {
    if (!file) {
      return;
    }

    let fileName = file.name;
    const contentType = file.type;

    if (fileName === 'image.png') {
      fileName = 'image-' + new Date().toISOString() + '.png';
    }

    if (isFileDangerous(fileName)) {
      showToastAtCenter(i18n('dangerousFileType'));
      return;
    }

    // check file size
    if (file.size === 0) {
      showToastAtCenter(i18n('pulllingZeroSizeError'));
      return;
    }

    // 附件read失败，认为是文件夹
    try {
      await readAttachment({
        file,
        size: file.size,
        contentType,
        fileName,
      });
    } catch (_e) {
      showToastAtCenter(i18n('pulllingFolderError'));
      return;
    }

    if (attachments.length >= 32) {
      showToastAtCenter(i18n('maximumAttachments'));
      return;
    }

    const renderVideoPreview = async () => {
      const objectUrl = URL.createObjectURL(file);
      try {
        const type = IMAGE_PNG;
        const thumbnail = await VisualAttachment.makeVideoScreenshot({
          objectUrl,
          contentType: type,
          logger: mainWindow.log,
        });
        const data = await VisualAttachment.blobToArrayBuffer(thumbnail);
        const url = arrayBufferToObjectURL({
          data,
          type,
        });
        addAttachment({
          file,
          size: file.size,
          fileName,
          contentType,
          videoUrl: objectUrl,
          url,
        });
      } catch (_error) {
        URL.revokeObjectURL(objectUrl);
      }
    };

    const renderImagePreview = async () => {
      const url = URL.createObjectURL(file);
      if (!url) {
        throw new Error('Failed to create object url for image!');
      }
      addAttachment({
        file,
        size: file.size,
        fileName,
        contentType,
        url,
      });
    };

    try {
      const blob = await autoScale({
        contentType,
        file,
      });
      let limitKb = 200 * 1024;
      const blobType =
        file.type === 'image/gif' ? 'gif' : contentType.split('/')[0];

      switch (blobType) {
        case 'image':
          limitKb = 30 * 1024;
          break;
        case 'gif':
          limitKb = 30 * 1024;
          break;
        case 'audio':
          limitKb = 200 * 1024;
          break;
        case 'video':
          limitKb = 200 * 1024;
          break;
        default:
          limitKb = 200 * 1024;
          break;
      }
      const limitSize = limitKb * 1024;
      if (blob.file.size > limitSize) {
        showToastAtCenter(
          i18n('fileSizeWarning', [filesize(limitSize, { spacer: '' })])
        );
        return;
      }
    } catch (error: any) {
      mainWindow.log.error(
        'Error ensuring that image is properly sized:',
        error && error.stack ? error.stack : error
      );

      showToastAtCenter(i18n('unableToLoadAttachment'));
      return;
    }

    try {
      if (isImageTypeSupported(contentType)) {
        await renderImagePreview();
      } else if (isVideoTypeSupported(contentType)) {
        await renderVideoPreview();
      } else {
        addAttachment({
          file,
          size: file.size,
          contentType,
          fileName,
          url: '',
        });
      }
    } catch (e: any) {
      mainWindow.log.error(
        `Was unable to generate thumbnail for file type ${contentType}`,
        e && e.stack ? e.stack : e
      );
      addAttachment({
        file,
        size: file.size,
        contentType,
        fileName,
        url: '',
      });
    }
  });

  const onNewClipboardEvent = useMemoizedFn(
    async (e: ClipboardEvent & { originalEvent?: ClipboardEvent }) => {
      const clipboardData = e.clipboardData || e.originalEvent?.clipboardData;
      if (!clipboardData) {
        return;
      }
      const itemsArray = Array.from(clipboardData.items);

      const hasText = itemsArray.some(item => {
        return item.type === 'text/plain' && item.kind === 'string';
      });

      if (hasText) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      let attachments = itemsArray
        .map(item => item.getAsFile())
        .filter(Boolean);

      if (attachments.length === 0) {
        attachments = await tryGetAttachmentsFromHtml(itemsArray);
      }

      for (const file of attachments) {
        await onNewFileChange(file);
      }
    }
  );

  useEffect(() => {
    if (newFile) {
      onNewFileChange(newFile);
    }
  }, [newFile]);

  useEffect(() => {
    if (newAttachment) {
      addAttachment(newAttachment);
    }
  }, [newAttachment]);

  useEffect(() => {
    if (newClipboardEvent) {
      onNewClipboardEvent(newClipboardEvent);
    }
  }, [newClipboardEvent]);

  useEffect(() => {
    onAttachmentsChange(attachments);
  }, [attachments]);

  const prevResetCount = usePrevious(resetCount);

  useEffect(() => {
    if (prevResetCount !== resetCount && prevResetCount !== 0) {
      setAttachments([]);
      onAttachmentsChange([]);
    }
  }, [resetCount]);

  const attachmentsForDisplay = (attachments || []).filter(
    attachment => !attachment.isVoiceNote
  );

  return (
    <div>
      <AttachmentList
        attachments={attachmentsForDisplay}
        i18n={i18n}
        onClickAttachment={onClickAttachment}
        onCloseAttachment={onCloseAttachment}
        onAddAttachment={onAddAttachment}
        onClose={onClose}
      />
    </div>
  );
};
