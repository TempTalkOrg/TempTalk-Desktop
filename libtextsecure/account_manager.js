/* global
  window,
  textsecure,
  libsignal,
  WebSocketResource,
  btoa,
  getString,
  libphonenumber,
  Event,
  ConversationController
*/

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function () {
  window.textsecure = window.textsecure || {};

  const ARCHIVE_AGE = 30 * 24 * 60 * 60 * 1000;

  function AccountManager(username, password) {
    this.server = window.WebAPI.connect({ username, password });
    this.pending = Promise.resolve();
  }

  function getNumber(numberId) {
    if (!numberId || !numberId.length) {
      return numberId;
    }
    const parts = numberId.split('.');
    if (!parts.length) {
      return numberId;
    }

    return parts[0];
  }

  AccountManager.prototype = new textsecure.EventTarget();
  AccountManager.prototype.extend({
    constructor: AccountManager,
    requestSMSVerification(number) {
      return this.server.requestVerificationSMS(number);
    },
    registerSingleDevice(number, verificationCode, pinCode, defaultName) {
      const createAccount = this.createAccount.bind(this);
      const clearSessionsAndPreKeys = this.clearSessionsAndPreKeys.bind(this);
      const registrationDone = this.registrationDone.bind(this);

      return this.queueTask(() =>
        libsignal.KeyHelper.generateIdentityKeyPair().then(identityKeyPair => {
          const profileKey = textsecure.crypto.getRandomBytes(32);
          // default readReceipts set to true.
          const readReceipts = true;

          return createAccount(
            number,
            verificationCode,
            identityKeyPair,
            profileKey,
            undefined,
            'OWI',
            readReceipts,
            pinCode
          )
            .then(clearSessionsAndPreKeys)
            .then(() => registrationDone(number, defaultName));
        })
      );
    },
    registerSecondDevice(setProvisioningUrl, confirmNumber, progressCallback) {
      const createAccount = this.createAccount.bind(this);
      const clearSessionsAndPreKeys = this.clearSessionsAndPreKeys.bind(this);
      const registrationDone = this.registrationDone.bind(this);
      const getSocket = this.server.getProvisioningSocket.bind(this.server);
      const queueTask = this.queueTask.bind(this);
      const provisioningCipher = new libsignal.ProvisioningCipher();
      let gotProvisionEnvelope = false;
      return provisioningCipher.getPublicKey().then(
        pubKey =>
          new Promise((resolve, reject) => {
            const socket = getSocket();
            socket.onclose = event => {
              window.log.info('provisioning socket closed. Code:', event.code);
              if (!gotProvisionEnvelope) {
                reject(new Error('websocket closed'));
              }
            };
            socket.onopen = () => {
              window.log.info('provisioning socket open');
            };
            const wsr = new WebSocketResource(socket, {
              keepalive: { path: '/v1/keepalive/provisioning' },
              handleRequest(request) {
                if (request.path === '/v1/address' && request.verb === 'PUT') {
                  const proto = textsecure.protobuf.ProvisioningUuid.decode(
                    request.body
                  );
                  setProvisioningUrl(
                    [
                      'tsdevice:/?uuid=',
                      proto.uuid,
                      '&pub_key=',
                      encodeURIComponent(btoa(getString(pubKey))),
                    ].join('')
                  );
                  request.respond(200, 'OK');
                } else if (
                  request.path === '/v1/message' &&
                  request.verb === 'PUT'
                ) {
                  const envelope = textsecure.protobuf.ProvisionEnvelope.decode(
                    request.body,
                    'binary'
                  );
                  request.respond(200, 'OK');
                  gotProvisionEnvelope = true;
                  wsr.close();
                  resolve(
                    provisioningCipher
                      .decrypt(envelope)
                      .then(provisionMessage =>
                        queueTask(() =>
                          confirmNumber(provisionMessage.number).then(
                            deviceName => {
                              if (
                                typeof deviceName !== 'string' ||
                                deviceName.length === 0
                              ) {
                                throw new Error('Invalid device name');
                              }
                              //配置meetingVersion 来自(background.js)
                              let meetingVersion = window.Signal.OS.isMacOS()
                                ? MAC_MEETINGVERSION
                                : LINUX_MEETINGVERSION;

                              return createAccount(
                                provisionMessage.number,
                                provisionMessage.provisioningCode,
                                provisionMessage.identityKeyPair,
                                provisionMessage.profileKey,
                                deviceName,
                                provisionMessage.userAgent,
                                provisionMessage.readReceipts,
                                null,
                                meetingVersion
                              )
                                .then(clearSessionsAndPreKeys)
                                .then(() => {
                                  registrationDone(provisionMessage.number);
                                });
                            }
                          )
                        )
                      )
                  );
                } else {
                  window.log.error('Unknown websocket message', request.path);
                }
              },
            });
          })
      );
    },
    queueTask(task) {
      const taskWithTimeout = textsecure.createTaskWithTimeout(task);
      this.pending = this.pending.then(taskWithTimeout, taskWithTimeout);

      return this.pending;
    },
    createAccount(
      number,
      verificationCode,
      identityKeyPair,
      profileKey,
      deviceName,
      userAgent,
      readReceipts,
      pinCode,
      meetingVersion
    ) {
      const signalingKey = libsignal.crypto.getRandomBytes(32 + 20);
      let password = btoa(getString(libsignal.crypto.getRandomBytes(16)));
      password = password.substring(0, password.length - 2);
      const registrationId = libsignal.KeyHelper.generateRegistrationId();

      return this.server
        .confirmCode(
          number,
          verificationCode,
          password,
          signalingKey,
          registrationId,
          deviceName,
          pinCode,
          meetingVersion
        )
        .then(response => {
          const previousNumber = getNumber(textsecure.storage.get('number_id'));
          if (!previousNumber) {
            return response;
          } else if (previousNumber === number) {
            // user number not changed
            response.isSameUserWithPrevious = true;
            return response;
          } else {
            window.log.warn('New number is different from old number');

            const warningText =
              'You are logging in a different user, ' +
              'previous data would be removed, are you sure continue?';

            if (!window.confirm(warningText)) {
              window.log.warn('user has canceled this loggin.');
              return this.server.unlinkCurrentDevice().then(() => {
                throw new Error('User has canceled this loggin.');
              });
            }

            const loginInfo = textsecure.storage.get('loginInfo') || {};

            window.log.warn('deleting all previous data');
            return textsecure.storage.protocol.removeAllData().then(
              () => {
                window.log.info('Successfully deleted previous data');

                textsecure.storage.put('loginInfo', loginInfo);

                return response;
              },
              error => {
                window.log.error(
                  'Something went wrong deleting data from previous number',
                  error && error.stack ? error.stack : error
                );

                textsecure.storage.put('loginInfo', loginInfo);

                return this.server.unlinkCurrentDevice().finally(() => {
                  throw new Error('Failed to remove previous data');
                });
              }
            );
          }
        })
        .then(async response => {
          await Promise.all([
            textsecure.storage.remove('identityKey'),
            textsecure.storage.remove('signaling_key'),
            textsecure.storage.remove('password'),
            textsecure.storage.remove('registrationId'),
            textsecure.storage.remove('number_id'),
            textsecure.storage.remove('device_name'),
            textsecure.storage.remove('regionCode'),
            textsecure.storage.remove('userAgent'),
            textsecure.storage.remove('profileKey'),
            textsecure.storage.remove('read-receipts-setting'),
            textsecure.storage.remove('should-upgrade-db-key'),
          ]);

          // update our own identity key, which may have changed
          // if we're relinking after a reinstall on the master device
          await textsecure.storage.protocol.saveIdentityWithAttributes(number, {
            id: number,
            publicKey: identityKeyPair.pubKey,
            firstUse: true,
            timestamp: Date.now(),
            verified: textsecure.storage.protocol.VerifiedStatus.VERIFIED,
            nonblockingApproval: true,
          });

          await textsecure.storage.put('identityKey', identityKeyPair);
          await textsecure.storage.put('signaling_key', signalingKey);
          await textsecure.storage.put('password', password);
          await textsecure.storage.put('registrationId', registrationId);
          if (profileKey) {
            await textsecure.storage.put('profileKey', profileKey);
          }
          if (userAgent) {
            await textsecure.storage.put('userAgent', userAgent);
          }

          // force enable read receipt
          await textsecure.storage.put('read-receipt-setting', true);

          await textsecure.storage.user.setNumberAndDeviceId(
            number,
            response.deviceId || 1,
            deviceName
          );

          const regionCode = libphonenumber.util.getRegionCodeForNumber(number);
          await textsecure.storage.put('regionCode', regionCode);

          await textsecure.storage.put(
            'should-upgrade-db-key',
            !response.isSameUserWithPrevious
          );
        });
    },
    clearSessionsAndPreKeys() {
      const store = textsecure.storage.protocol;

      window.log.info('clearing all sessions, prekeys, and signed prekeys');
      return Promise.all([
        store.clearPreKeyStore(),
        store.clearSignedPreKeysStore(),
        store.clearSessionStore(),
      ]);
    },
    async registrationDone(number, defaultName) {
      window.log.info('registration done');

      // Ensure that we always have a conversation for ourself
      const me = await ConversationController.getOrCreateAndWait(
        number,
        'private'
      );

      try {
        const result = await this.server.fetchDirectoryContacts([number]);
        const myProfile = result.data.contacts[0];
        if (myProfile && myProfile.number === number) {
          const { avatar } = myProfile;
          if (avatar) {
            myProfile.commonAvatar = me.parsePrivateAvatar(avatar);
          }

          me.updateAttributesPrivate(myProfile);
        }
      } catch (error) {
        log.error('our contact profile update failed.', error);
      }

      let attributes = {};

      // if no previous name was got, use new  username
      if (!me.get('name') || me.get('name') === me.get('id')) {
        if (defaultName) {
          let uploadName = defaultName;
          if (uploadName.length > 30) {
            uploadName = uploadName.substring(0, 30);
          }

          await this.server.setProfile({ name: uploadName });
          attributes.name = uploadName;
        }
      }

      attributes.active_at = Date.now();
      if ((await window.Signal.Data.getStickConversationCount()) === 0) {
        attributes.isStick = true;
      }

      me.set(attributes);
      await window.Signal.Data.updateConversation(attributes);

      this.dispatchEvent(new Event('registration'));
    },
    async redeemAccount(invitationCode) {
      return this.server.redeemAccount(invitationCode).then(response => {
        return {
          account: response.account,
          verificationCode: response.vcode,
        };
      });
    },
    async unlinkCurrentDevice() {
      return this.server.unlinkCurrentDevice();
    },
    async reportException(exception) {
      return this.server.reportException(exception);
    },
    async setProfile(obj) {
      return this.server.setProfile(obj);
    },
    async getAvatarUploadId() {
      return this.server.getAvatarUploadId();
    },
    async putAvatar(ossUrl, encryptedBin, attachmentId, encAlgo, encKey) {
      return this.server.putAvatar(
        ossUrl,
        encryptedBin,
        attachmentId,
        encAlgo,
        encKey
      );
    },
    async putGroupAvatar(
      attachmentId,
      b64Key,
      b64Digest,
      groupIdV2,
      imageByteCount
    ) {
      return this.server.putGroupAvatar(
        attachmentId,
        b64Key,
        b64Digest,
        groupIdV2,
        imageByteCount
      );
    },
    async getKeysV3ForUids(uids) {
      return this.server.getKeysV3ForUids(uids);
    },
    getDevices() {
      return this.server.getDevices();
    },
    getNonceForSecretUpload(publicKey) {
      return this.server
        .getNonceForSecretUpload(publicKey)
        .then(response => response?.data?.nonce);
    },
    uploadSecret(options) {
      return this.server.uploadSecret(options);
    },
    getDirectoryProfile() {
      return this.server.getDirectoryProfile();
    },
    requestBindVerificationEmail(email, nonce) {
      return this.server.requestBindVerificationEmail(email, nonce);
    },
    bindEmail(email, code, nonce) {
      return this.server.bindEmail(email, code, nonce);
    },
    requestBindVerificationSMS(phoneNumber, nonce) {
      return this.server.requestBindVerificationSMS(phoneNumber, nonce);
    },
    bindPhone(phoneNumber, code, nonce) {
      return this.server.bindPhone(phoneNumber, code, nonce);
    },
  });
  textsecure.AccountManager = AccountManager;
})();
