const { isArrayBuffer, isFunction, omit } = require('lodash');
const { encryptAttachment, getKeys } = require('../crypto');

exports.rewriteFileWithEncryption = async (
  attachment,
  { deleteAttachmentData, loadAttachmentData, writeNewAttachmentData } = {}
) => {
  if (!isFunction(deleteAttachmentData)) {
    throw new TypeError("'deleteAttachmentData' must be a function");
  }
  if (!isFunction(loadAttachmentData)) {
    throw new TypeError("'loadAttachmentData' must be a function");
  }
  if (!isFunction(writeNewAttachmentData)) {
    throw new TypeError("'writeNewAttachmentData' must be a function");
  }

  const isDownloaded = !!attachment.path;

  const shouldSkipSchemaUpgrade = !isDownloaded || attachment.encryptionKey;

  if (shouldSkipSchemaUpgrade) {
    return attachment;
  }

  const { data } = await loadAttachmentData(attachment);
  const oldPath = attachment.path;

  const isValidData = isArrayBuffer(data);
  if (!isValidData) {
    throw new TypeError(
      'Expected `attachment.data` to be an array buffer;' +
        ` got: ${typeof attachment.data}`
    );
  }

  const keys = getKeys();
  const dataToWrite = await encryptAttachment(data, keys);
  const encryptionKey = keys.toString('base64');
  const path = await writeNewAttachmentData(dataToWrite);

  await deleteAttachmentData(oldPath);

  const attachmentWithoutData = omit(
    Object.assign({}, attachment, { path, encryptionKey }),
    ['data']
  );
  return attachmentWithoutData;
};
