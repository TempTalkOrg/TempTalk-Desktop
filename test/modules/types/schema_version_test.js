const { assert } = require('chai');

const SchemaVersion = require('../../../js/modules/types/schema_version');

describe('SchemaVersion', () => {
  describe('isValid', () => {
    it('should return true for positive integers', () => {
      assert.isTrue(SchemaVersion.isValid(0));
      assert.isTrue(SchemaVersion.isValid(1));
      assert.isTrue(SchemaVersion.isValid(2));
    });

    it('should return false for any other value', () => {
      assert.isFalse(SchemaVersion.isValid(null));
      assert.isFalse(SchemaVersion.isValid(-1));
      assert.isFalse(SchemaVersion.isValid(''));
    });
  });
});
