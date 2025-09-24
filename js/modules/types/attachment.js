const { isString, isFunction } = require('lodash');

const AttachmentTS = require('../../../ts/types/Attachment');
const GoogleChrome = require('../../../ts/util/GoogleChrome');
const MIME = require('../../../ts/types/MIME');
const { toLogFormat } = require('./errors');
const { blobToArrayBuffer } = require('blob-util');
const {
  migrateDataToFileSystem,
} = require('./attachment/migrate_data_to_file_system');
const {
  rewriteFileWithEncryption,
} = require('./attachment/rewrite_file_with_encryption');
const { decryptAttachment } = require('./crypto');

// // Incoming message attachment fields
// {
//   id: string
//   contentType: MIMEType
//   data: ArrayBuffer
//   digest: ArrayBuffer
//   fileName?: string
//   flags: null
//   key: ArrayBuffer
//   size: integer
//   thumbnail: ArrayBuffer
// }

// // Outgoing message attachment fields
// {
//   contentType: MIMEType
//   data: ArrayBuffer
//   fileName: string
//   size: integer
// }

// Returns true if `rawAttachment` is a valid attachment based on our current schema.
// Over time, we can expand this definition to become more narrow, e.g. require certain
// fields, etc.
exports.isValid = rawAttachment => {
  // NOTE: We cannot use `_.isPlainObject` because `rawAttachment` is
  // deserialized by protobuf:
  if (!rawAttachment) {
    return false;
  }

  return true;
};

const UNICODE_LEFT_TO_RIGHT_OVERRIDE = '\u202D';
const UNICODE_RIGHT_TO_LEFT_OVERRIDE = '\u202E';
const UNICODE_REPLACEMENT_CHARACTER = '\uFFFD';
const INVALID_CHARACTERS_PATTERN = new RegExp(
  `[${UNICODE_LEFT_TO_RIGHT_OVERRIDE}${UNICODE_RIGHT_TO_LEFT_OVERRIDE}]`,
  'g'
);
// NOTE: Expose synchronous version to do property-based testing using `testcheck`,
// which currently doesn’t support async testing:
// https://github.com/leebyron/testcheck-js/issues/45
exports._replaceUnicodeOrderOverridesSync = attachment => {
  if (!isString(attachment.fileName)) {
    return attachment;
  }

  const normalizedFilename = attachment.fileName.replace(
    INVALID_CHARACTERS_PATTERN,
    UNICODE_REPLACEMENT_CHARACTER
  );
  const newAttachment = Object.assign({}, attachment, {
    fileName: normalizedFilename,
  });

  return newAttachment;
};

exports.replaceUnicodeOrderOverrides = async attachment =>
  exports._replaceUnicodeOrderOverridesSync(attachment);

// \u202A-\u202E is LRE, RLE, PDF, LRO, RLO
// \u2066-\u2069 is LRI, RLI, FSI, PDI
// \u200E is LRM
// \u200F is RLM
// \u061C is ALM
const V2_UNWANTED_UNICODE = /[\u202A-\u202E\u2066-\u2069\u200E\u200F\u061C]/g;

exports.replaceUnicodeV2 = async attachment => {
  if (!isString(attachment.fileName)) {
    return attachment;
  }

  const fileName = attachment.fileName.replace(
    V2_UNWANTED_UNICODE,
    UNICODE_REPLACEMENT_CHARACTER
  );

  return {
    ...attachment,
    fileName,
  };
};

exports.removeSchemaVersion = ({ attachment, logger }) => {
  if (!exports.isValid(attachment)) {
    logger.error(
      'Attachment.removeSchemaVersion: Invalid input attachment:',
      attachment
    );
    return attachment;
  }

  const attachmentWithoutSchemaVersion = Object.assign({}, attachment);
  delete attachmentWithoutSchemaVersion.schemaVersion;
  return attachmentWithoutSchemaVersion;
};

exports.migrateDataToFileSystem = migrateDataToFileSystem;
exports.rewriteFileWithEncryption = rewriteFileWithEncryption;

//      hasData :: Attachment -> Boolean
exports.hasData = attachment =>
  attachment.data instanceof ArrayBuffer || ArrayBuffer.isView(attachment.data);

//      loadData :: (RelativePath -> IO (Promise ArrayBuffer))
//                  Attachment ->
//                  IO (Promise Attachment)
exports.loadData = readAttachmentData => {
  if (!isFunction(readAttachmentData)) {
    throw new TypeError("'readAttachmentData' must be a function");
  }

  return async attachment => {
    if (!exports.isValid(attachment)) {
      throw new TypeError("'attachment' is not valid");
    }

    const isAlreadyLoaded = exports.hasData(attachment);
    if (isAlreadyLoaded) {
      return attachment;
    }

    if (!isString(attachment.path)) {
      throw new TypeError("'attachment.path' is required");
    }

    const data = await readAttachmentData(attachment.path);

    if (AttachmentTS.isEncryptedVoiceMessage(attachment)) {
      const keys = Buffer.from(attachment.encryptionKey, 'base64');
      const decryptedData = await decryptAttachment(data, keys);

      return Object.assign({}, attachment, {
        data: decryptedData,
        size: decryptedData.byteLength,
      });
    } else {
      return Object.assign({}, attachment, { data, size: data.byteLength });
    }
  };
};

//      deleteData :: (RelativePath -> IO Unit)
//                    Attachment ->
//                    IO Unit
exports.deleteData = deleteOnDisk => {
  if (!isFunction(deleteOnDisk)) {
    throw new TypeError('deleteData: deleteOnDisk must be a function');
  }

  return async attachment => {
    if (!exports.isValid(attachment)) {
      throw new TypeError('deleteData: attachment is not valid');
    }

    const { path, thumbnail, screenshot } = attachment;
    if (isString(path)) {
      await deleteOnDisk(path);
    }

    if (thumbnail && isString(thumbnail.path)) {
      await deleteOnDisk(thumbnail.path);
    }

    if (screenshot && isString(screenshot.path)) {
      await deleteOnDisk(screenshot.path);
    }
  };
};

exports.isVoiceMessage = AttachmentTS.isVoiceMessage;
exports.save = AttachmentTS.save;

const THUMBNAIL_SIZE = 150;
const THUMBNAIL_CONTENT_TYPE = 'image/png';

exports.captureDimensionsAndScreenshot = async (
  attachment,
  {
    writeNewAttachmentData,
    getAbsoluteAttachmentPath,
    makeObjectUrl,
    revokeObjectUrl,
    getImageDimensions,
    makeImageThumbnail,
    makeVideoScreenshot,
    logger,
  }
) => {
  const { contentType } = attachment;

  if (
    !GoogleChrome.isImageTypeSupported(contentType) &&
    !GoogleChrome.isVideoTypeSupported(contentType)
  ) {
    return attachment;
  }

  // If the attachment hasn't been downloaded yet, we won't have a path
  if (!attachment.path) {
    return attachment;
  }

  const absolutePath = await getAbsoluteAttachmentPath(attachment.path);

  if (GoogleChrome.isImageTypeSupported(contentType)) {
    try {
      const { width, height } = await getImageDimensions({
        objectUrl: absolutePath,
        logger,
      });
      const thumbnailBuffer = await blobToArrayBuffer(
        await makeImageThumbnail({
          size: THUMBNAIL_SIZE,
          objectUrl: absolutePath,
          contentType: THUMBNAIL_CONTENT_TYPE,
          logger,
        })
      );

      const thumbnailPath = await writeNewAttachmentData(thumbnailBuffer);
      return {
        ...attachment,
        width,
        height,
        thumbnail: {
          path: thumbnailPath,
          contentType: THUMBNAIL_CONTENT_TYPE,
          width: THUMBNAIL_SIZE,
          height: THUMBNAIL_SIZE,
        },
      };
    } catch (error) {
      logger.error(
        'captureDimensionsAndScreenshot:',
        'error processing image; skipping screenshot generation',
        toLogFormat(error)
      );
      return attachment;
    }
  }

  let screenshotObjectUrl;
  try {
    const screenshotBuffer = await blobToArrayBuffer(
      await makeVideoScreenshot({
        objectUrl: absolutePath,
        contentType: THUMBNAIL_CONTENT_TYPE,
        logger,
      })
    );
    screenshotObjectUrl = makeObjectUrl(
      screenshotBuffer,
      THUMBNAIL_CONTENT_TYPE
    );
    const { width, height } = await getImageDimensions({
      objectUrl: screenshotObjectUrl,
      logger,
    });
    const screenshotPath = await writeNewAttachmentData(screenshotBuffer);

    const thumbnailBuffer = await blobToArrayBuffer(
      await makeImageThumbnail({
        size: THUMBNAIL_SIZE,
        objectUrl: screenshotObjectUrl,
        contentType: THUMBNAIL_CONTENT_TYPE,
        logger,
      })
    );

    const thumbnailPath = await writeNewAttachmentData(thumbnailBuffer);

    return {
      ...attachment,
      screenshot: {
        contentType: THUMBNAIL_CONTENT_TYPE,
        path: screenshotPath,
        width,
        height,
      },
      thumbnail: {
        path: thumbnailPath,
        contentType: THUMBNAIL_CONTENT_TYPE,
        width: THUMBNAIL_SIZE,
        height: THUMBNAIL_SIZE,
      },
      width,
      height,
    };
  } catch (error) {
    logger.error(
      'captureDimensionsAndScreenshot: error processing video; skipping screenshot generation',
      toLogFormat(error)
    );
    return attachment;
  } finally {
    revokeObjectUrl(screenshotObjectUrl);
  }
};
