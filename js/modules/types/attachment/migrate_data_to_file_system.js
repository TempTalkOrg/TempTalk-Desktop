const { isArrayBuffer, isFunction, isUndefined, omit } = require('lodash');
const AttachmentTS = require('../../../../ts/types/Attachment');
const { encryptAttachment, getKeys } = require('../crypto');

// type Context :: {
//   writeNewAttachmentData :: ArrayBuffer -> Promise (IO Path)
// }
//
//      migrateDataToFileSystem :: Attachment ->
//                                 Context ->
//                                 Promise Attachment
exports.migrateDataToFileSystem = async (
  attachment,
  { writeNewAttachmentData } = {}
) => {
  if (!isFunction(writeNewAttachmentData)) {
    throw new TypeError("'writeNewAttachmentData' must be a function");
  }

  const { data } = attachment;
  const hasData = !isUndefined(data);
  const shouldSkipSchemaUpgrade = !hasData;
  if (shouldSkipSchemaUpgrade) {
    return attachment;
  }

  const isValidData = isArrayBuffer(data);

  if (isValidData) {
  } else if (typeof data === 'object' && attachment.path) {
    return omit(attachment, ['data']);
  } else {
    throw new TypeError(
      'Expected `attachment.data` to be an array buffer;' +
        ` got: ${typeof attachment.data}`
    );
  }

  let path;
  let encryptionKey;
  let dataToWrite;
  if (AttachmentTS.isVoiceMessage(attachment)) {
    const keys = getKeys();
    dataToWrite = await encryptAttachment(data, keys);
    encryptionKey = keys.toString('base64');
  } else {
    dataToWrite = data;
  }
  path = await writeNewAttachmentData(dataToWrite);

  const attachmentWithoutData = omit(
    Object.assign({}, attachment, { path, encryptionKey }),
    encryptionKey ? ['data'] : ['data', 'encryptionKey']
  );
  return attachmentWithoutData;
};
