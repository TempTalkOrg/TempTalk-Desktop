window.textsecure = window.textsecure || {};

class OuterRequest {
  constructor() {
    // no need authentication
    this.server = WebAPI.connect({ username: '', password: '' });
  }

  async pingURL(url, mainDomain, userAgent) {
    return this.server.pingURL(url, mainDomain, userAgent);
  }

  async getGlobalConfig(url) {
    return this.server.getGlobalConfig(url);
  }

  async getNonceForSecretGet(publicKey) {
    return this.server
      .getNonceForSecretGet(publicKey)
      .then(response => response?.data?.nonce);
  }

  async getSecret(signature, nonce) {
    return this.server
      .getSecret(signature, nonce)
      .then(response => response?.data?.secretText);
  }
}

textsecure.OuterRequest = class OuterRequestWrapper {
  constructor() {
    const requester = new OuterRequest();

    this.pingURL = requester.pingURL.bind(requester);
    this.getGlobalConfig = requester.getGlobalConfig.bind(requester);
    this.getNonceForSecretGet = requester.getNonceForSecretGet.bind(requester);
    this.getSecret = requester.getSecret.bind(requester);
  }
};
