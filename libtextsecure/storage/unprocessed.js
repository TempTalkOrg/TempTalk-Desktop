/* global window, textsecure */

// eslint-disable-next-line func-names
(function () {
  /** ***************************************
   *** Not-yet-processed message storage ***
   **************************************** */
  window.textsecure = window.textsecure || {};
  window.textsecure.storage = window.textsecure.storage || {};

  window.textsecure.storage.unprocessed = {
    getCount() {
      return textsecure.storage.protocol.getUnprocessedCount();
    },
    getAll() {
      return textsecure.storage.protocol.getAllUnprocessed();
    },
    get(id) {
      return textsecure.storage.protocol.getUnprocessedById(id);
    },
    add(data) {
      return textsecure.storage.protocol.addUnprocessed(data);
    },
    batchAdd(array) {
      return textsecure.storage.protocol.addMultipleUnprocessed(array);
    },
    // updateAttempts(id, attempts) {
    //   return textsecure.storage.protocol.updateUnprocessedAttempts(
    //     id,
    //     attempts
    //   );
    // },
    // addDecryptedData(id, data) {
    //   return textsecure.storage.protocol.updateUnprocessedWithData(id, data);
    // },
    updateUnprocesseds(array) {
      return textsecure.storage.protocol.updateUnprocessedsWithData(array);
    },
    remove(idOrIds) {
      return textsecure.storage.protocol.removeUnprocessed(idOrIds);
    },
    removeAll() {
      return textsecure.storage.protocol.removeAllUnprocessed();
    },
    // updateRequiredProtocolVersion(id, requiredProtocolVersion) {
    //   return textsecure.storage.protocol.updateUnprocessedRequiredProtocolVersion(
    //     id,
    //     requiredProtocolVersion
    //   );
    // }
    deduplicate() {
      return textsecure.storage.protocol.deduplicateUnprocessed();
    },
    getDupilicateCount() {
      return textsecure.storage.protocol.getUnprocessedDuplicatedCount();
    },
  };
})();
