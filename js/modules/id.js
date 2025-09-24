const Crypto = require('./crypto');

function convertIdToV1(idV2) {
  const prefix = idV2?.slice(0, 4);
  if (prefix === 'WEEK') {
    return Crypto.binaryFromHex(idV2.slice(4));
  } else {
    return idV2;
  }
}

function convertIdToV2(idV1) {
  const idV1Len = 16;

  if (idV1?.length === idV1Len) {
    const hexId = Crypto.hexFromBinary(idV1);
    return 'WEEK' + hexId.toUpperCase();
  } else {
    return idV1;
  }
}

function isBotId(id) {
  if (typeof id !== 'string') {
    return false;
  }

  const MAX_BOT_ID_LENGHT = 6;
  const idLen = id.trim().replace(/^\+/, '').length;
  if (idLen && idLen <= MAX_BOT_ID_LENGHT) {
    return true;
  }

  return false;
}

const MENTIONS_ALL_ID = 'MENTIONS_ALL';

function getUniformId(conversationId) {
  let number;
  let groupId;

  if (typeof conversationId === 'string') {
    // string begins with +, and others char is number, treated as number
    // otherwise, treated as groupId
    if (/^\+\d+$/.test(conversationId)) {
      number = conversationId;
    } else {
      groupId = conversationId;
    }
  } else {
    ({ number, groupId } = conversationId || {});
  }

  const conversationIdV1 = {};
  const conversationIdV2 = {};

  if (number) {
    conversationIdV1.number = number;
    conversationIdV2.number = number;
  } else if (groupId) {
    const len = groupId.length;
    if (len === 16) {
      conversationIdV1.groupId = groupId;
      conversationIdV2.groupId = convertIdToV2(groupId);
    } else if (/^[0-9a-f]{32}$/.test(groupId)) {
      // d12fc79ce97740d0a8d54d6b8e26baa2
      conversationIdV1.groupId = groupId;
      conversationIdV2.groupId = groupId;
    } else if (/^WEEK[0-9A-F]{32}$/.test(groupId)) {
      // WEEKF39A251FCA0865F7FF0CD534C13F3592
      conversationIdV1.groupId = convertIdToV1(groupId);
      conversationIdV2.groupId = groupId;
    } else {
      window.log.error('invalid group id format', groupId);
      throw new Error('invalid group id format');
    }
  } else {
    window.log.error('invalid conversation id,', conversationId);
    throw new Error('invalid conversation id.');
  }

  return {
    getIdForCompatible: () => conversationIdV1,
    getIdForRestfulAPI: () => conversationIdV2,
    getSimplifyId: () => (number ? number : conversationIdV1.groupId),
    getIdForLogging: () => conversationIdV2,
  };
}

function validateIdFromServer(id) {
  return /^((\+\d+)|([0-9a-f]{32})|(WEEK[0-9A-F]{32}))$/.test(id);
}

module.exports = {
  isBotId,
  convertIdToV1,
  convertIdToV2,
  MENTIONS_ALL_ID,
  getUniformId,
  validateIdFromServer,
};
