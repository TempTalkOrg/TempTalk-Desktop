/* global extension: false */

(function () {
  'use strict';

  // Browser specific functions for Chrom*
  window.extension = window.extension || {};

  extension.windows = {
    onClosed(callback) {
      window.addEventListener('beforeunload', callback);
      return () => {
        window.removeEventListener('beforeunload', callback);
      };
    },
  };
})();
