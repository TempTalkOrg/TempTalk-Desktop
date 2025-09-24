// should be used after libtextsecure.js loaded
export class UserStorage {
  private static getStorage() {
    // @ts-ignore
    return window.textsecure?.storage?.user;
  }

  static getNumber(): string | undefined {
    return this.getStorage()?.getNumber();
  }

  static getDeviceName(): string | undefined {
    return this.getStorage()?.getDeviceName();
  }

  static getDeviceId(): number | undefined {
    const deviceId = this.getStorage()?.getDeviceId();
    return deviceId ? parseInt(deviceId) : undefined;
  }

  static isPrimaryDevice() {
    return this.getDeviceId() == 1;
  }
}
