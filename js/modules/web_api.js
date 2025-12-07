const WebSocket = require('websocket').w3cwebsocket;
const fetch = require('node-fetch');
const { ProxyAgent } = require('proxy-agent');
const { Agent } = require('https');
const { isString, isObject, isNumber, isArray, omit } = require('lodash');
const {
  getWebApiUserAgent,
  initWebApiUserAgent,
} = require('../../ts/web_api/util');
const { API_STATUS } = require('../../ts/types/APIStatus');

const isNonEmptyString = value => value && isString(value);

const validateMap = (dataMap, validatorWrapper) => {
  for (const [key, validator] of Object.entries(dataMap)) {
    validatorWrapper(key, validator);
  }
};

// const { redactAll } = require('./privacy');

/* global Buffer: false */
/* global setTimeout: false */
/* global log: false */

let globalWebApiUrls = {};
const websocketUrlSelect = {
  chat: [],
  last_chat: '',
};

const SERVICE_LIST = {
  CHAT: 'chat',
  CALL: 'call',
  FILE_SHARING: 'fileSharing',
  SPEECH2TEXT: 'speech2text',
  AVATAR: 'avatar',
  LIVEKIT: 'livekit',

  // outer
  OUTER: 'outer',
};

const DYN_SERVICE_LIST = [...Object.values(omit(SERVICE_LIST, ['OUTER']))];

window.DYN_SERVICE_LIST = DYN_SERVICE_LIST;

const AUTH_TOKEN_SERVICES = [
  SERVICE_LIST.CHAT,
  SERVICE_LIST.CALL,
  SERVICE_LIST.FILE_SHARING,
  SERVICE_LIST.SPEECH2TEXT,
];

function disableNetwork(type, url) {
  const items = globalWebApiUrls[type];
  if (items) {
    for (let i = 0; i < items.length; i += 1) {
      if (url.startsWith(items[i].url) && items[i].ms >= 0) {
        items[i].ms = -1;
        log.info(`[network optimize] disable [${type}] ${items[i].url}.`);

        // 非主窗口先不触发测速，先轮询换域名尝试
        if (window.selectBestDomain) {
          window.selectBestDomain();
        }
        return;
      }
    }
  }
}

window.freshWebApiUrlCache = c => {
  globalWebApiUrls = c;
};

const resetWebsocketUrlSelect = () => {
  websocketUrlSelect.chat = [];
  websocketUrlSelect.last_chat = '';
};

function _btoa(str) {
  let buffer;

  if (str instanceof Buffer) {
    buffer = str;
  } else {
    buffer = Buffer.from(str.toString(), 'binary');
  }

  return buffer.toString('base64');
}

const _call = object => Object.prototype.toString.call(object);

const ArrayBufferToString = _call(new ArrayBuffer());
const Uint8ArrayToString = _call(new Uint8Array());

function _getString(thing) {
  if (typeof thing !== 'string') {
    if (_call(thing) === Uint8ArrayToString)
      return String.fromCharCode.apply(null, thing);
    if (_call(thing) === ArrayBufferToString)
      return _getString(new Uint8Array(thing));
  }
  return thing;
}

function _getStringable(thing) {
  return (
    typeof thing === 'string' ||
    typeof thing === 'number' ||
    typeof thing === 'boolean' ||
    (thing === Object(thing) &&
      (_call(thing) === ArrayBufferToString ||
        _call(thing) === Uint8ArrayToString))
  );
}

function _ensureStringed(thing) {
  if (_getStringable(thing)) {
    return _getString(thing);
  } else if (thing instanceof Array) {
    const res = [];
    for (let i = 0; i < thing.length; i += 1) {
      res[i] = _ensureStringed(thing[i]);
    }
    return res;
  } else if (thing === Object(thing)) {
    const res = {};
    // eslint-disable-next-line guard-for-in, no-restricted-syntax
    for (const key in thing) {
      res[key] = _ensureStringed(thing[key]);
    }
    return res;
  } else if (thing === null) {
    return null;
  } else if (thing === undefined) {
    return undefined;
  }
  throw new Error(`unsure of how to jsonify object of type ${typeof thing}`);
}

function _jsonThing(thing) {
  return JSON.stringify(_ensureStringed(thing));
}

function _validateResponse(response, schema) {
  try {
    // eslint-disable-next-line guard-for-in, no-restricted-syntax
    for (const i in schema) {
      switch (schema[i]) {
        case 'object':
        case 'string':
        case 'number':
          // eslint-disable-next-line valid-typeof
          if (typeof response[i] !== schema[i]) {
            return false;
          }
          break;
        default:
      }
    }
  } catch (ex) {
    return false;
  }
  return true;
}

function _createSocket(url, { certificateAuthority, proxyUrl, authorization }) {
  const requestOptions = { ca: certificateAuthority };

  if (proxyUrl) {
    Object.assign(requestOptions, {
      agent: new ProxyAgent({
        getProxyForUrl: () => proxyUrl,
      }),
    });
  }

  // 添加 User-Agent
  const headers = { 'user-agent': getWebApiUserAgent() };

  if (authorization) {
    headers.Authorization = authorization;
  }

  const clientConfig = { maxReceivedFrameSize: 0x410000 };

  // eslint-disable-next-line new-cap
  return new WebSocket(url, null, null, headers, requestOptions, clientConfig);
}

const FIVE_MINUTES = 1000 * 60 * 5;
const agents = {
  unauth: null,
  auth: null,
};

const CERT_ERRORS = [
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_CRL',
  'UNABLE_TO_DECRYPT_CERT_SIGNATURE',
  'UNABLE_TO_DECRYPT_CRL_SIGNATURE',
  'UNABLE_TO_DECODE_ISSUER_PUBLIC_KEY',

  'CERT_SIGNATURE_FAILURE',
  'CRL_SIGNATURE_FAILURE',
  'CERT_NOT_YET_VALID',
  'CERT_HAS_EXPIRED',
  'CRL_NOT_YET_VALID',

  'CRL_HAS_EXPIRED',
  'ERROR_IN_CERT_NOT_BEFORE_FIELD',
  'ERROR_IN_CERT_NOT_AFTER_FIELD',
  'ERROR_IN_CRL_LAST_UPDATE_FIELD',
  'ERROR_IN_CRL_NEXT_UPDATE_FIELD',

  'OUT_OF_MEM',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',

  'CERT_CHAIN_TOO_LONG',
  'CERT_REVOKED',
  'INVALID_CA',
  'PATH_LENGTH_EXCEEDED',
  'INVALID_PURPOSE',

  'CERT_UNTRUSTED',
  'CERT_REJECTED',
  'ERR_TLS_CERT_ALTNAME_FORMAT',
  'ERR_TLS_CERT_ALTNAME_INVALID',
];

function _promiseAjax(providedUrl, options) {
  return new Promise((resolve, reject) => {
    const url = providedUrl || `${options.host}/${options.path}`;
    log.info(
      `${options.type} ${url}${options.unauthenticated ? ' (unauth)' : ''}`
    );
    const timeout =
      typeof options.timeout !== 'undefined' ? options.timeout : 30000;

    let hostKey = url;
    try {
      hostKey = new URL(url).host;
    } catch (error) {
      log.error('failt to parse url', url, error);
    }

    const proxyUrl = options.proxyUrl || '';
    const agentType = options.unauthenticated ? 'unauth' : 'auth';
    const cacheKey = `${hostKey}-${proxyUrl}-${agentType}`;

    const { timestamp } = agents[cacheKey] || {};
    if (!timestamp || timestamp + FIVE_MINUTES < Date.now()) {
      if (timestamp) {
        log.info(`Cycling agent for type ${cacheKey}`);
      }

      const rejectUnauthorized =
        options.rejectUnauthorized !== false
          ? true
          : options.rejectUnauthorized;

      // proxy cannot use rejectUnauthorized ???
      const agentOptions = {
        keepAlive: true,
        rejectUnauthorized,
      };

      agents[cacheKey] = {
        agent: proxyUrl
          ? new ProxyAgent({
              getProxyForUrl: () => proxyUrl,
            })
          : new Agent(agentOptions),
        timestamp: Date.now(),
      };
    }
    const { agent } = agents[cacheKey];

    if (!agent.defaultPort) {
      agent.defaultPort = 443;
    }

    const fetchOptions = {
      method: options.type,
      body: options.data || null,
      headers: { 'X-Difft-Agent': 'OWD', 'user-agent': getWebApiUserAgent() },
      agent,
      ca: options.certificateAuthority,
      timeout,
    };

    if (fetchOptions.body instanceof ArrayBuffer) {
      // node-fetch doesn't support ArrayBuffer, only node Buffer
      const contentLength = fetchOptions.body.byteLength;
      fetchOptions.body = Buffer.from(fetchOptions.body);

      // node-fetch doesn't set content-length like S3 requires
      fetchOptions.headers['Content-Length'] = contentLength;
    }

    if (options.authorization) {
      fetchOptions.headers.Authorization = options.authorization;
    }

    if (options.token) {
      fetchOptions.headers.token = options.token;
    }

    if (options.cacheControl) {
      fetchOptions.headers['Cache-Control'] = options.cacheControl;
    }

    if (options.userAgent) {
      fetchOptions.headers['user-agent'] = options.userAgent;
    }

    if (options.user && options.password) {
      const user = _getString(options.user);
      const password = _getString(options.password);
      const auth = _btoa(`${user}:${password}`);
      fetchOptions.headers.Authorization = `Basic ${auth}`;
    }

    if (options.contentType) {
      fetchOptions.headers['Content-Type'] = options.contentType;
    }

    if (options.acceptLanguage) {
      fetchOptions.headers['Accept-Language'] = options.acceptLanguage;
    }

    fetch(url, fetchOptions)
      .then(response => {
        let resultPromise;
        if (
          options.responseType === 'json' &&
          /^application\/json(;.*)?$/.test(
            response.headers.get('Content-Type') || ''
          )
        ) {
          resultPromise = response.json();
        } else if (options.responseType === 'arraybuffer') {
          resultPromise = response.buffer();
        } else {
          resultPromise = response.textConverted();
        }
        return resultPromise.then(result => {
          if (options.responseType === 'arraybuffer') {
            // eslint-disable-next-line no-param-reassign
            result = result.buffer.slice(
              result.byteOffset,
              result.byteOffset + result.byteLength
            );
          }
          if (options.responseType === 'json') {
            if (options.validateResponse) {
              if (!_validateResponse(result, options.validateResponse)) {
                log.error(options.type, url, response.status, 'Error');
                return reject(
                  HTTPError(
                    'promiseAjax: invalid response',
                    response.status,
                    result,
                    options.stack
                  )
                );
              }
            }

            // new APIs, should check more
            if (options.newAPI) {
              //check 'status' field
              if (result.status != 0) {
                log.error(
                  options.type,
                  url,
                  response.status,
                  'NewAPI Error:',
                  JSON.stringify(result)
                );

                const copyResult = { ...result };
                switch (response.status) {
                  case 401:
                    // if response code === 401 and
                    // response body has no status, set status = 5
                    // to indicate token is invalid.
                    if (result.status === undefined) {
                      copyResult.status = API_STATUS.InvalidToken;
                    }
                    break;
                  case 413:
                    // if response code === 413
                    // server may not set response status
                    copyResult.status = API_STATUS.RateLimitExceeded;
                    break;
                }

                // use code 400 to indicate an error response from server.
                return reject(
                  HTTPError(
                    'promiseAjax: server response error status',
                    400,
                    copyResult,
                    options.stack
                  )
                );
              }
            }
          }
          if (response.status >= 0 && response.status < 400) {
            log.info(options.type, url, response.status, 'Success');
            return resolve(result, response.status);
          } else {
            log.error(options.type, url, response.status, 'Error');
            return reject(
              HTTPError(
                'promiseAjax: error response',
                response.status === 502 ? -1 : response.status,
                result,
                options.stack
              )
            );
          }
        });
      })
      .catch(e => {
        log.error(options.type, url, 0, 'Error');
        const stack = `${e.stack}\nInitial stack:\n${options.stack}`;

        log.error('error=' + JSON.stringify(e));
        log.error('stack=' + stack);

        // remove cached agent
        if (agent === agents[cacheKey]?.agent) {
          agents[cacheKey] = null;
        }

        if (CERT_ERRORS.includes(e?.code) || CERT_ERRORS.includes(e?.errno)) {
          log.error('x509 certificate verification failed.', hostKey);
          window.badSelfSignedCert(hostKey);
        }

        return reject(HTTPError('promiseAjax catch', 0, e.toString(), stack));
      });
  });
}

function _retryAjax(url, options, providedLimit, providedCount) {
  const count = (providedCount || 0) + 1;
  const limit = providedLimit || 2;
  return _promiseAjax(url, options).catch(e => {
    if (e.name === 'HTTPError' && e.code === -1 && count < limit) {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(_retryAjax(url, options, limit, count));
        }, 1000);
      });
    }

    if (e.name === 'HTTPError' && e.code === -1 && count === limit) {
      const { serverType } = options;
      if (DYN_SERVICE_LIST.includes(serverType)) {
        disableNetwork(serverType, url);
      }
    }
    throw e;
  });
}

function HTTPError(message, providedCode, response, stack) {
  const code = providedCode > 999 || providedCode < 100 ? -1 : providedCode;
  const e = new Error(`${message}; code: ${code}`);
  e.name = 'HTTPError';
  e.code = code;
  e.stack += `\nOriginal stack:\n${stack}`;
  if (response) {
    e.response = response;
  }
  return e;
}

const URL_CALLS = {
  accounts: 'v1/accounts',
  devices: 'v1/devices',
  identity: 'v3/keys/identity/bulk',
  messages: 'v1/messages',
  messagesV3: 'v3/messages',
  attachment: 'v1/attachments',
  profile: 'v1/profile',
  avatarAttachment: 'v1/profile/avatar/attachment',
  directory: 'v1/directory',
  authV2: 'v2/auth',
  token: 'v1/authorize',
  groups: 'v1/groups',
  applications: 'v1/applications',
  reportException: 'v1/cltlog',
  conversation: 'v1/conversation',
  readPositions: 'v1/readReceipt',
  conversationSharedConfig: 'v1/conversationconfig/share',
  directoryV3: 'v3/directory',
  secrets: 'v1/secrets',
  call: 'v3/call',
};

module.exports = {
  initialize,
};

// We first set up the data that won't change during this session of the app
function initialize({
  certificateAuthority,
  proxyUrl,
  insiderUpdate,
  flavorId,
}) {
  if (!isString(certificateAuthority)) {
    throw new Error('WebAPI.initialize: Invalid certificateAuthority');
  }

  initWebApiUserAgent(insiderUpdate, flavorId);

  // Thanks to function-hoisting, we can put this return statement before all of the
  //   below function definitions.
  return {
    connect,
  };

  function _retryDomain(options, domains, index) {
    const currentIndex = index || 0;
    const url = domains[currentIndex].url;

    if (domains[currentIndex].certType === 'self') {
      options.certificateAuthority = certificateAuthority;
    }

    return _retryAjax(url, options).catch(e => {
      if (
        e.name === 'HTTPError' &&
        e.code === -1 &&
        currentIndex < domains.length - 1
      ) {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(_retryDomain(options, domains, currentIndex + 1));
          }, 0);
        });
      }
      throw e;
    });
  }

  function _outerAjax(url, options) {
    const { serverType } = options;

    const domains = [];
    if (serverType === SERVICE_LIST.OUTER) {
      return _retryAjax(url, options);
    }

    if (DYN_SERVICE_LIST.includes(serverType)) {
      const items = globalWebApiUrls[serverType] || [];
      for (let i = 0; i < items.length; i += 1) {
        // filter unavailable domains
        if (items[i].url && items[i].ms >= 0) {
          domains.push({
            url: `${items[i].url}/${options.path}`,
            certType: items[i].certType,
          });
        }
      }
      // 都不可用
      if (domains.length === 0) {
        for (let i = 0; i < items.length; i += 1) {
          if (items[i].url) {
            items[i].ms = 1;
            log.info(
              `[network optimize] rest network status [${serverType}] ${items[i].url}.`
            );
            domains.push({
              url: `${items[i].url}/${options.path}`,
              certType: items[i].certType,
            });
          }
        }
      }
    } else {
      throw 'Bad serverType';
    }

    if (domains.length === 0) {
      throw 'Bad domains list';
    }

    // eslint-disable-next-line no-param-reassign
    options.stack = new Error().stack; // just in case, save stack here.
    return _retryDomain(options, domains);
  }

  // Then we connect to the server with user-specific information. This is the only API
  //   exposed to the browser context, ensuring that it can't connect to arbitrary
  //   locations.
  function connect({
    username: initialUsername,
    password: initialPassword,
    firstRun,
  }) {
    let username = initialUsername;
    let password = initialPassword;

    let cachedToken;
    let refreshTokenTimer;
    let tokenValidityPeriod = 45 * 60 * 1000;

    if (firstRun) {
      resetWebsocketUrlSelect();
    }

    // Thanks, function hoisting!
    return {
      confirmCode,
      getAttachment,
      getAvatarUploadId,
      getAvatar,
      getDevices,
      getMessageSocket,
      getProfile,
      setProfile,
      getProvisioningSocket,
      putAttachment,
      requestVerificationSMS,
      sendMessages,
      redeemAccount,
      getGlobalConfig,

      createGroupV2,
      editGroupV2,
      queryGroupV2,
      getGroupV2List,
      addGroupV2Members,
      removeGroupV2Members,
      addGroupAdmin,
      removeGroupAdmin,
      transferGroupOwner,
      editGroupV2Member,
      getGroupV2Member,
      disbandGroupV2,
      getGroupV2InviteCode,
      getGroupV2InfoByInviteCode,
      joinGroupV2ByInviteCode,
      editGroupV2OnlyOwner,
      reportException,
      unlinkCurrentDevice,
      fetchDirectoryContacts,
      getAttachmentNew,
      putAttachmentNew,
      rapidUpload,
      reportFileBroken,
      putAvatar,
      putGroupAvatar,
      pingURL,
      deleteAuthorization,
      translateContent,

      sendMessageV3ToGroup,
      sendMessageV3ToNumber,

      // conversation to front
      conversationToFront,

      queryUserByInviteCode,
      generateInviteCode,

      getConversationSharedConfig,
      setConversationSharedConfig,

      setConversationConfig,
      getConversationConfig,

      //confident meeting
      getKeysV3ForUids,

      // friendship
      reportAbnormalUser,
      sendFriendRequest,
      deleteFriend,

      // secrets
      getNonceForSecretUpload,
      uploadSecret,
      getNonceForSecretGet,
      getSecret,

      // directory v3
      // profile
      getDirectoryProfile,

      // bind third accounts
      requestBindVerificationEmail,
      bindEmail,
      requestBindVerificationSMS,
      bindPhone,

      // call
      startCall,
      joinCall,
      inviteCall,
      listCalls,
      checkCall,
      controlCall,
      getCallServiceUrls,
      getCallToken,
      submitCallFeedback,
      speechToText,
    };

    function _ajax(param) {
      if (!param.urlParameters) {
        // eslint-disable-next-line no-param-reassign
        param.urlParameters = '';
      }

      return _outerAjax(null, {
        serverType: SERVICE_LIST.CHAT,
        certificateAuthority,
        contentType: 'application/json; charset=utf-8',
        data: param.jsonData && _jsonThing(param.jsonData),
        // host: url, // 因为域名自动选择，这个字段用不到了
        password,
        acceptLanguage: param.acceptLanguage,
        path: URL_CALLS[param.call] + param.urlParameters,
        proxyUrl,
        responseType: param.responseType,
        timeout: param.timeout,
        type: param.httpType,
        user: username,
        validateResponse: param.validateResponse,
        newAPI: param.newAPI,
      }).catch(e => {
        const { code } = e;
        if (code === 200) {
          // happens sometimes when we get no response
          // (TODO: Fix server to return 204? instead)
          return null;
        }
        let message;
        switch (code) {
          case -1:
            message =
              'Failed to connect to the server, please check your network connection.';
            break;
          case 413:
            message = 'Rate limit exceeded, please try again later.';
            break;
          case 403:
            message = 'Invalid code, please try again.';
            break;
          case 417:
            // TODO: This shouldn't be a thing?, but its in the API doc?
            message = 'Number already registered.';
            break;
          case 401:
            message =
              'Invalid authentication, most likely someone re-registered and invalidated our registration.';
            break;
          case 404:
            message = 'Number is not registered.';
            break;
          case 430:
            message = 'Sending messages to this user is forbidden.';
            break;
          default:
            message =
              'The server rejected our query, please file a bug report.';
        }
        e.message = `${message} (original: ${e.message})`;
        throw e;
      });
    }

    function getProfile(number) {
      return _ajax({
        call: 'profile',
        httpType: 'GET',
        urlParameters: `/${number}`,
        responseType: 'json',
      });
    }

    function setProfile(obj) {
      log.info('web_api.js setProfile param=' + JSON.stringify(obj));
      return _ajax({
        call: 'profile',
        httpType: 'PUT',
        responseType: 'json',
        jsonData: obj,
        contentType: 'application/json; charset=utf-8',
      });
    }

    function getAvatarUploadId() {
      log.info('web_api.js getAvatarUploadId');
      return _ajax({
        call: 'avatarAttachment',
        httpType: 'GET',
        responseType: 'json',
        contentType: 'application/json; charset=utf-8',
      });
    }

    function getAvatar(attachmentId) {
      return _outerAjax(null, {
        path: attachmentId,
        serverType: SERVICE_LIST.AVATAR,
        proxyUrl,
        responseType: 'arraybuffer',
        timeout: 60 * 1000,
        type: 'GET',
      });
    }

    function requestVerificationSMS(number) {
      return _ajax({
        call: 'accounts',
        httpType: 'GET',
        responseType: 'json',
        urlParameters: `/sms/code/${number}`,
      });
    }

    async function confirmCode(
      number,
      code,
      newPassword,
      signalingKey,
      registrationId,
      deviceName,
      pinCode,
      meetingVersion = null
    ) {
      const jsonData = {
        signalingKey: _btoa(_getString(signalingKey)),
        supportsSms: false,
        fetchesMessages: true,
        registrationId,
        pin: pinCode,
      };

      let call;
      let urlPrefix;
      let schema;
      let responseType;

      if (deviceName) {
        jsonData.name = deviceName;
        if (meetingVersion) {
          jsonData.meetingVersion = meetingVersion;
        }

        call = 'devices';
        urlPrefix = '/';
        schema = { deviceId: 'number' };
        responseType = 'json';
      } else {
        call = 'accounts';
        urlPrefix = '/code/';
      }

      // We update our saved username and password, since we're creating a new account
      username = number;
      password = newPassword;

      const response = await _ajax({
        call,
        httpType: 'PUT',
        urlParameters: urlPrefix + code,
        jsonData,
        responseType,
        validateResponse: schema,
      });

      // From here on out, our username will be our phone number combined with device
      username = `${number}.${response.deviceId || 1}`;

      return response;
    }

    function getDevices() {
      return _ajax({
        call: 'devices',
        httpType: 'GET',
        responseType: 'json',
      });
    }

    //举报
    async function reportAbnormalUser(uid, type, reason, block) {
      const path = 'v3/accounts/report';
      const jsonData = {
        uid: uid,
        type: type,
        reason: reason,
      };

      if (typeof block !== 'undefined') {
        jsonData.block = !!block;
      }

      return _request(
        path,
        jsonData,
        {
          serverType: SERVICE_LIST.CHAT,
          type: 'POST',
        },
        false
      );
    }
    //申请加好友
    async function sendFriendRequest(uid, source = null, action = null) {
      const path = 'v3/friend/ask';
      const jsonData = {
        uid: uid,
        //source:source
      };
      if (source) {
        jsonData.source = source;
      }
      if (action) {
        jsonData.action = action;
      }
      return _request(
        path,
        jsonData,
        {
          serverType: SERVICE_LIST.CHAT,
          type: 'POST',
        },
        false
      );
    }

    async function deleteFriend(uid) {
      const path = 'v3/friend/' + uid;

      return _request(
        path,
        {},
        {
          serverType: SERVICE_LIST.CHAT,
          type: 'DELETE',
        },
        false
      );
    }

    //获取某个用户的公钥以及meetingVersion
    async function getKeysV3ForUids(uids) {
      const path = 'v3/keys/identity/bulk';
      const jsonData = {
        uids,
      };
      return _request(path, jsonData, {
        serverType: SERVICE_LIST.CHAT,
        type: 'POST',
      });
    }

    function sendMessages(destination, messageArray, timestamp, silent) {
      const jsonData = { messages: messageArray, timestamp };

      if (silent) {
        jsonData.silent = true;
      }

      return _ajax({
        call: 'messages',
        httpType: 'PUT',
        urlParameters: `/${destination}`,
        jsonData,
        responseType: 'json',
      });
    }

    function getAttachment(id) {
      return _ajax({
        call: 'attachment',
        httpType: 'GET',
        urlParameters: `/${id}`,
        responseType: 'json',
        validateResponse: { location: 'string' },
      }).then(response =>
        // Using _outerAJAX, since it's not hardcoded to the Signal Server
        _outerAjax(response.location, {
          serverType: SERVICE_LIST.OUTER,
          // contentType: 'application/octet-stream',
          proxyUrl,
          responseType: 'arraybuffer',
          timeout: 15 * 60 * 1000, // 15 mins
          type: 'GET',
        })
      );
    }

    function putAttachment(encryptedBin) {
      return _ajax({
        call: 'attachment',
        httpType: 'GET',
        responseType: 'json',
      }).then(response =>
        // Using _outerAJAX, since it's not hardcoded to the Signal Server
        _outerAjax(response.location, {
          serverType: SERVICE_LIST.OUTER,
          // contentType: 'application/octet-stream',
          data: encryptedBin,
          processData: false,
          proxyUrl,
          timeout: 15 * 60 * 1000,
          type: 'PUT',
        }).then(() => response.idString)
      );
    }

    function selectWebsocketUrl(type) {
      // 设置上次url不可用，然后触发测速
      const lastURL = websocketUrlSelect['last_' + type];
      if (lastURL) {
        disableNetwork(type, lastURL);
      }

      // 挑选可用域名
      if (websocketUrlSelect[type].length === 0) {
        const items = globalWebApiUrls[type];
        for (let i = 0; i < items.length; i += 1) {
          if (items[i].url && items[i].ms >= 0) {
            websocketUrlSelect[type].push(items[i].url);
          }
        }
      }

      // 都不可用，重置网络
      if (websocketUrlSelect[type].length === 0) {
        const items = globalWebApiUrls[type];
        for (let i = 0; i < items.length; i += 1) {
          if (items[i].url) {
            items[i].ms = 1;
            log.info(
              `[network optimize] rest network status [${type}] ${items[i].url}.`
            );
            websocketUrlSelect[type].push(items[i].url);
          }
        }
      }

      if (websocketUrlSelect[type].length === 0) {
        throw Error(`selectWebsocketUrl fatal error ${type} length === 0.`);
      }

      const select_url = websocketUrlSelect[type][0];
      websocketUrlSelect[type].splice(0, 1);
      websocketUrlSelect['last_' + type] = select_url;
      return select_url;
    }

    function getMessageSocket() {
      log.info('opening message socket start');
      const select_url = selectWebsocketUrl('chat');
      log.info('opening message socket:', select_url);

      const fixedScheme = select_url
        .replace('https://', 'wss://')
        .replace('http://', 'ws://');

      const auth = _btoa(`${_getString(username)}:${_getString(password)}`);
      const authorization = `Basic ${auth}`;

      return _createSocket(`${fixedScheme}/v1/websocket/?agent=OWD`, {
        certificateAuthority,
        proxyUrl,
        authorization,
      });
    }

    function getProvisioningSocket() {
      log.info('opening provisioning socket start');
      const select_url = selectWebsocketUrl('chat');
      log.info('opening provisioning socket:', select_url);

      const fixedScheme = select_url
        .replace('https://', 'wss://')
        .replace('http://', 'ws://');

      return _createSocket(
        `${fixedScheme}/v1/websocket/provisioning/?agent=OWD`,
        { certificateAuthority, proxyUrl }
      );
    }

    /*
      numbers: if null, get all contacts(include myself)
        else some numbers
      properties: if null, get basic properties
                  (number, name, email, avatar, avatarKey and signature)
        else is all, get all properties
    */
    function fetchDirectoryContacts(numbers, properties = 'all') {
      log.info(
        'fetch directory contact(s) from server for',
        numbers?.length ? numbers : 'all',
        'with properties:',
        properties
      );

      const uids = numbers;
      const jsonData = uids && uids.length > 0 ? { uids } : undefined;
      const urlParams = new URLSearchParams({ properties });

      return _ajax({
        call: 'directory',
        newAPI: true,
        urlParameters: `/contacts?${urlParams.toString()}`,
        httpType: 'POST',
        responseType: 'json',
        jsonData,
        acceptLanguage: window.getLocalLanguage(),
      });
    }

    function _getToken() {
      return _ajax({
        call: 'token',
        urlParameters: '/token',
        httpType: 'PUT',
        responseType: 'json',
      });
    }

    function redeemAccount(invitationCode) {
      log.info('redeem account by invite code.');
      return _ajax({
        call: 'accounts',
        httpType: 'GET',
        responseType: 'json',
        urlParameters: `/invitation/${invitationCode}`,
      });
    }

    function getGlobalConfig(globalConfigUrl) {
      return _outerAjax(globalConfigUrl, {
        serverType: SERVICE_LIST.OUTER,
        proxyUrl,
        responseType: 'json',
        type: 'GET',
        timeout: 5000,
        cacheControl: 'no-cache',
      });
    }

    function createGroupV2(groupName, groupAvatar, expiration, members) {
      const jsonData = {
        name: groupName,
        avatar: groupAvatar,
        messageExpiry: expiration,
        numbers: members,
      };

      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'PUT',
        responseType: 'json',
        jsonData,
      });
    }

    function editGroupV2(
      groupId,
      groupName,
      groupOwner,
      groupAvatar,
      expiration,
      remindCycle
    ) {
      let jsonData = {};

      if (groupName) {
        jsonData.name = groupName;
      }

      if (groupOwner) {
        jsonData.owner = groupOwner;
      }

      if (groupAvatar) {
        jsonData.avatar = groupAvatar;
      }

      if (typeof expiration === 'number') {
        jsonData.messageExpiry = expiration;
      }

      if (remindCycle) {
        jsonData.remindCycle = remindCycle;
      }
      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'POST',
        responseType: 'json',
        jsonData,
        urlParameters: `/${groupId}`,
      });
    }

    function queryGroupV2(groupId) {
      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'GET',
        responseType: 'json',
        urlParameters: `/${groupId}`,
      });
    }

    function getGroupV2List() {
      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'GET',
        responseType: 'json',
      });
    }

    function addGroupV2Members(groupId, members) {
      let jsonData = {
        numbers: members,
      };

      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'PUT',
        responseType: 'json',
        urlParameters: `/${groupId}/members`,
        jsonData,
      });
    }

    function removeGroupV2Members(groupId, members) {
      let jsonData = {
        numbers: members,
      };

      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'DELETE',
        responseType: 'json',
        urlParameters: `/${groupId}/members`,
        jsonData,
      });
    }

    function addGroupAdmin(groupId, member) {
      let jsonData = {
        role: 1,
      };

      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'POST',
        responseType: 'json',
        urlParameters: `/${groupId}/members/${member}`,
        jsonData,
      });
    }

    function removeGroupAdmin(groupId, member) {
      let jsonData = {
        role: 2,
      };

      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'POST',
        responseType: 'json',
        urlParameters: `/${groupId}/members/${member}`,
        jsonData,
      });
    }

    function transferGroupOwner(groupId, member) {
      let jsonData = {
        owner: member,
      };

      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'POST',
        responseType: 'json',
        urlParameters: `/${groupId}`,
        jsonData,
      });
    }

    function editGroupV2Member(
      groupId,
      number,
      role,
      displayName,
      remark,
      notification
    ) {
      let jsonData = {};

      if (role) {
        jsonData.role = role;
      }

      if (displayName) {
        jsonData.displayName = displayName;
      }

      if (remark) {
        jsonData.remark = remark;
      }

      if (typeof notification === 'number') {
        jsonData.notification = notification;
      }

      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'POST',
        responseType: 'json',
        urlParameters: `/${groupId}/members/${number}`,
        jsonData,
      });
    }

    function getGroupV2Member(groupId) {
      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'GET',
        responseType: 'json',
        urlParameters: `/${groupId}/members`,
      });
    }

    function disbandGroupV2(groupId) {
      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'DELETE',
        responseType: 'json',
        urlParameters: `/${groupId}`,
      });
    }

    function getGroupV2InviteCode(groupId) {
      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'GET',
        responseType: 'json',
        urlParameters: `/invitation/${groupId}`,
      });
    }

    function getGroupV2InfoByInviteCode(groupInviteCode) {
      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'GET',
        responseType: 'json',
        urlParameters: `/invitation/groupInfo/${groupInviteCode}`,
      });
    }

    function joinGroupV2ByInviteCode(groupInviteCode) {
      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'PUT',
        responseType: 'json',
        urlParameters: `/invitation/join/${groupInviteCode}`,
      });
    }

    function editGroupV2OnlyOwner(groupId, data) {
      const {
        invitationRule,
        anyoneRemove,
        rejoin,
        publishRule,
        anyoneChangeName,
        linkInviteSwitch,
      } = data;
      const jsonData = {};

      if (invitationRule) {
        jsonData.invitationRule = invitationRule;
      }

      if (anyoneRemove !== undefined) {
        jsonData.anyoneRemove = anyoneRemove;
      }

      if (rejoin !== undefined) {
        jsonData.rejoin = rejoin;
      }

      if (publishRule) {
        jsonData.publishRule = publishRule;
      }

      if (anyoneChangeName !== undefined) {
        jsonData.anyoneChangeName = anyoneChangeName;
      }

      if (linkInviteSwitch) {
        jsonData.linkInviteSwitch = linkInviteSwitch;
      }

      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'POST',
        responseType: 'json',
        jsonData,
        urlParameters: `/${groupId}`,
      });
    }

    function unlinkCurrentDevice() {
      return _ajax({
        call: 'devices',
        httpType: 'DELETE',
        responseType: 'json',
      });
    }

    function reportException(exception) {
      return _ajax({
        call: 'reportException',
        httpType: 'POST',
        responseType: 'json',
        jsonData: exception,
        urlParameters: `?level=ERROR`,
      });
    }

    async function _getOrRefreshToken(forceRefresh) {
      if (cachedToken && !forceRefresh) {
        return cachedToken;
      }

      if (refreshTokenTimer) {
        clearTimeout(refreshTokenTimer);
        refreshTokenTimer = undefined;
      }

      const result = await _getToken();
      cachedToken = result?.data?.token;
      if (!cachedToken) {
        log.error('server response token is invalid.');
        throw new Error('server response invalid token.');
      }

      // 解析token有效期
      const items = cachedToken.split('.');
      if (items.length >= 3) {
        try {
          const item = window.atob(items[1]);
          const obj = JSON.parse(item);
          if (obj.iat && obj.exp) {
            // 冗余10分钟吧
            tokenValidityPeriod = (obj.exp - obj.iat - 10 * 60) * 1000;
          }
        } catch (e) {}
      }

      if (refreshTokenTimer) {
        clearTimeout(refreshTokenTimer);
      }

      refreshTokenTimer = setTimeout(async () => {
        refreshTokenTimer = undefined;
        await _getOrRefreshToken(true);
      }, tokenValidityPeriod);

      return cachedToken;
    }

    async function _request(
      path,
      jsonData = {},
      options = {},
      returnData = true
    ) {
      const token = await _getOrRefreshToken();
      const bodyJson = { ...jsonData };

      const upperType = options.type ? options.type.toUpperCase() : 'POST';

      const hasBody =
        Object.keys(bodyJson).length > 0 ||
        upperType === 'POST' ||
        upperType === 'PUT';

      if (hasBody) {
        bodyJson.token = token;
      }

      const needAuthorization = AUTH_TOKEN_SERVICES.includes(
        options.serverType
      );

      if (needAuthorization) {
        options.authorization = token;
      }

      options = {
        path,
        contentType: 'application/json; charset=utf-8',
        proxyUrl,
        responseType: 'json',
        type: 'POST',
        // timeout: 0, // using default timeout
        newAPI: true,
        ...options,
        data: hasBody ? _jsonThing(bodyJson) : null,
        token,
      };

      let result;
      try {
        result = await _outerAjax(null, options);
      } catch (error) {
        const { response, name, code } = error;
        if (name === 'HTTPError' && code === 400) {
          const { status } = response;
          if (status === API_STATUS.NoPermission) {
            log.error('have no permission');
            error.code = 403;
            throw error;
          } else if (status === API_STATUS.InvalidToken) {
            // invalid token
            // force refresh token and retry
            const retryToken = await _getOrRefreshToken(true);
            if (hasBody) {
              bodyJson.token = retryToken;
            }

            options = {
              ...options,
              data: hasBody ? _jsonThing(bodyJson) : null,
              token: retryToken,
              authorization: needAuthorization ? retryToken : undefined,
            };
            result = await _outerAjax(null, options);
          } else {
            log.info(jsonData);
            throw error;
          }
        } else {
          throw error;
        }
      }

      if (returnData) {
        const { data } = result;
        if (!data) {
          log.error('there is no data field in response.');
          throw new Error('server response invalid data.');
        }

        return data;
      }
    }

    function rapidUpload(rapidHash, numbers) {
      const path = 'v1/file/isExists';

      const jsonData = {
        fileHash: rapidHash,
        numbers,
      };
      return _request(path, jsonData, {
        serverType: SERVICE_LIST.FILE_SHARING,
      });
    }

    function reportFileBroken(rapidHash, authorizeId) {
      const path = 'v1/file/delete';

      const jsonData = {
        fileHash: rapidHash,
        authorizeId,
      };
      return _request(path, jsonData, {
        serverType: SERVICE_LIST.FILE_SHARING,
      });
    }

    function uploadData(requestUrl, data) {
      return _outerAjax(requestUrl, {
        serverType: SERVICE_LIST.OUTER,
        data,
        processData: false,
        proxyUrl,
        timeout: 15 * 60 * 1000,
        type: 'PUT',
      });
    }

    // attachment
    // {
    //   "fileHash":"11211131",
    //   "attachmentId":"eccb9bb4546f430989b3ee4b6f6a37c2",
    //   "fileSize":100,
    //   "hashAlg":"sha256",
    //   "keyAlg":"sha256",
    //   "encAlg":"sha256",
    // }
    function informUpload(attachment, numbers) {
      const path = 'v1/file/uploadInfo';
      const jsonData = {
        ...attachment,
        numbers,
      };
      return _request(path, jsonData, {
        serverType: SERVICE_LIST.FILE_SHARING,
      });
    }

    function requestDownloadInfo(rapidHash, authorizeId, gid) {
      const path = 'v1/file/download';
      const jsonData = {
        fileHash: rapidHash,
        authorizeId,
        gid,
      };
      return _request(path, jsonData, {
        serverType: SERVICE_LIST.FILE_SHARING,
      });
    }

    function downloadData(downloadUrl) {
      return _outerAjax(downloadUrl, {
        serverType: SERVICE_LIST.OUTER,
        // contentType: 'application/octet-stream',
        proxyUrl,
        responseType: 'arraybuffer',
        timeout: 15 * 60 * 1000,
        type: 'GET',
      });
    }

    async function getAttachmentNew(rapidHash, authorizeId, gid) {
      try {
        const dlInfo = await requestDownloadInfo(rapidHash, authorizeId, gid);

        const { fileSize, url } = dlInfo;
        const encryptedBin = await downloadData(url);

        log.info(
          'download fileSize, originalSize:',
          encryptedBin.byteLength,
          fileSize
        );

        return {
          ...dlInfo,
          encryptedBin,
        };
      } catch (error) {
        log.error('get attachment failed, ', error);
        throw error;
      }
    }

    async function putAttachmentNew(
      encryptedBin,
      binMD5,
      plaintextLen,
      ossUrl,
      attachmentId,
      rapidHash,
      numbers
    ) {
      try {
        // 1 upload data
        await uploadData(ossUrl, encryptedBin, binMD5);

        // 2 inform server a new uploaded file
        const attachment = {
          fileHash: rapidHash,
          attachmentId,
          fileSize: plaintextLen,
          hashAlg: 'SHA-256',
          keyAlg: 'SHA-512',
          encAlg: 'AES-CBC-256',
          cipherHash: binMD5,
          cipherHashType: 'MD5',
        };
        return await informUpload(attachment, numbers);
      } catch (error) {
        log.error('put attachment failed,', error);
        throw error;
      }
    }

    async function deleteAuthorization(rapidFiles) {
      if (!(rapidFiles instanceof Array && rapidFiles.length > 0)) {
        throw new Error('invalid rapid files array.');
      }

      const path = 'v1/file/delAuthorize';
      const jsonData = {
        delAuthorizeInfos: rapidFiles,
      };

      return _request(
        path,
        jsonData,
        { serverType: SERVICE_LIST.FILE_SHARING },
        false
      );
    }

    async function putGroupAvatar(
      attachmentId,
      b64Key,
      b64Digest,
      groupIdV2,
      imageByteCount
    ) {
      const orign = {
        byteCount: imageByteCount + '',
        digest: b64Digest,
        encryptionKey: b64Key,
        serverId: attachmentId,
        attachmentType: 0,
        contentType: 'image/png',
      };
      let b64Avatar = window.Signal.Crypto.base64Encode(JSON.stringify(orign));
      return editGroupV2(
        groupIdV2,
        undefined,
        undefined,
        JSON.stringify({ data: b64Avatar })
      );
    }

    async function putAvatar(
      ossUrl,
      encryptedBin,
      attachmentId,
      encAlgo,
      encKey
    ) {
      try {
        await uploadData(ossUrl, encryptedBin);
        return await setProfile({
          avatar: JSON.stringify({ attachmentId, encAlgo, encKey }),
        });
      } catch (error) {
        log.error('put avatar failed,', error);
        throw error;
      }
    }

    function pingURL(requestUrl, mainDomain, userAgent) {
      return _outerAjax(requestUrl, {
        serverType: SERVICE_LIST.OUTER,
        certificateAuthority: mainDomain ? certificateAuthority : undefined,
        userAgent,
        type: 'GET',
      });
    }

    async function translateContent(contents, targetLang, sourceLang) {
      const path = 'v1/translate';
      const jsonData = {
        sourceLang,
        targetLang,
        contents,
      };

      log.info('targetLang:', targetLang);

      return _request(path, jsonData, { serverType: SERVICE_LIST.TRANSLATE });
    }

    function sendMessageV3ToNumber(destination, message, timestamp, silent) {
      const jsonData = { ...message };
      if (silent) {
        jsonData.silent = true;
      }
      if (timestamp) {
        jsonData.timestamp = timestamp;
      }
      return _ajax({
        call: 'messagesV3',
        httpType: 'PUT',
        urlParameters: `/${destination}`,
        jsonData,
        responseType: 'json',
      });
    }

    function sendMessageV3ToGroup(destination, message, timestamp, silent) {
      const jsonData = { ...message };
      if (silent) {
        jsonData.silent = true;
      }
      if (timestamp) {
        jsonData.timestamp = timestamp;
      }
      return _ajax({
        call: 'messagesV3',
        httpType: 'PUT',
        urlParameters: `/group/${destination}`,
        jsonData,
        responseType: 'json',
      });
    }

    function conversationToFront(conversationId) {
      const { number, groupId: gid } = conversationId || {};

      const jsonData = { number, gid };

      return _ajax({
        call: 'messages',
        httpType: 'POST',
        urlParameters: `/setPriorConversation`,
        responseType: 'json',
        jsonData,
      });
    }

    function queryUserByInviteCode(pi) {
      const path = 'v3/accounts/querybyInviteCode';
      const jsonData = {
        inviteCode: pi,
      };
      return _request(path, jsonData, {
        serverType: SERVICE_LIST.CHAT,
        type: 'PUT',
      });
    }

    function generateInviteCode(regenerate = 0, short = 1) {
      const path = `v3/accounts/inviteCode?regenerate=${regenerate}&short=${short}`;
      return _request(
        path,
        {},
        {
          serverType: SERVICE_LIST.CHAT,
          type: 'POST',
        }
      );
    }

    function getConversationSharedConfig(
      ourNumber,
      conversationId,
      checkAsk = false
    ) {
      const { number, groupId } = conversationId || {};
      const jsonData = { checkAsk: !!checkAsk };

      if (number) {
        if (number > ourNumber) {
          jsonData.conversations = [`${ourNumber}:${number}`];
        } else {
          jsonData.conversations = [`${number}:${ourNumber}`];
        }
      } else if (groupId) {
        jsonData.conversations = [groupId];
      } else {
        throw new Error('invalid conversationId');
      }

      // return _ajax({
      //   call: 'conversationSharedConfig',
      //   httpType: 'POST',
      //   responseType: 'json',
      //   jsonData,
      // });

      return _request(URL_CALLS['conversationSharedConfig'], jsonData, {
        serverType: SERVICE_LIST.CHAT,
        type: 'POST',
      });
    }

    function setConversationSharedConfig(ourNumber, conversationId, config) {
      const { number, groupId } = conversationId || {};

      let id;

      if (number) {
        if (number < ourNumber) {
          id = `${number}:${ourNumber}`;
        } else {
          id = `${ourNumber}:${number}`;
        }
      } else if (groupId) {
        id = groupId;
      } else {
        throw new Error('invalid conversationId');
      }

      // return _ajax({
      //   call: 'conversationSharedConfig',
      //   httpType: 'PUT',
      //   responseType: 'json',
      //   urlParameters: `${id}`,
      //   jsonData: config,
      // });

      return _request(
        `${URL_CALLS['conversationSharedConfig']}/${id}`,
        config,
        {
          serverType: SERVICE_LIST.CHAT,
          type: 'PUT',
        }
      );
    }

    function getConversationConfig(idOrIds) {
      const jsonData = {};

      let ids = [];
      if (typeof idOrIds === 'object') {
        ids = [idOrIds];
      } else if (idOrIds instanceof Array && idOrIds?.length) {
        ids = idOrIds;
      }

      if (ids.length) {
        const conversations = [];

        ids.forEach(id => {
          if (!id) {
            return;
          }

          const { number, groupId } = id;
          const conversation = number || groupId;

          if (conversation) {
            conversations.push(conversation);
          }
        });

        Object.assign(jsonData, { conversations });
      }
      return _ajax({
        call: 'conversation',
        newAPI: true,
        httpType: 'POST',
        responseType: 'json',
        jsonData,
        urlParameters: `/get`,
        acceptLanguage: window.getLocalLanguage(),
      });
    }

    function setConversationConfig(conversationId, config) {
      const { number, groupId } = conversationId || {};
      const jsonData = {};

      const conversation = number || groupId;
      if (!conversation) {
        throw new Error('invalid conversationId');
      }

      const { muteStatus, blockStatus, confidentialMode, remark } =
        config || {};
      if (typeof muteStatus === 'number') {
        Object.assign(jsonData, { muteStatus });
      }

      if (typeof blockStatus === 'number') {
        Object.assign(jsonData, { blockStatus });
      }

      if (typeof confidentialMode === 'number') {
        Object.assign(jsonData, { confidentialMode });
      }

      if (typeof remark === 'string') {
        Object.assign(jsonData, { remark });
      }

      if (!Object.keys(jsonData).length) {
        throw new Error('emtpy valid config to set');
      }

      // set conversation
      Object.assign(jsonData, { conversation });

      return _ajax({
        call: 'conversation',
        newAPI: true,
        httpType: 'POST',
        responseType: 'json',
        jsonData,
        urlParameters: `/set`,
      });
    }

    // ***** secret uploading and downloading *****
    /*
      function: uploadSecretGetNonce
      description: get one-time nonce for secret upload
      authentication: basic auth
    */
    function getNonceForSecretUpload(publicKey) {
      if (!publicKey) {
        throw new Error('input param publicKey can not be empty');
      }

      const jsonData = { userPk: publicKey };

      return _ajax({
        call: 'secrets',
        urlParameters: '/uploadSecretNonce',
        httpType: 'POST',
        responseType: 'json',
        jsonData,
        newAPI: true,
      });
    }

    /*
      function: uploadSecret
      description: secret uploading
      authentication: basic auth
    */
    function uploadSecret({ secretText, nonce, signature, deviceInfo }) {
      const jsonData = {
        secretText,
        signature,
        nonce,
        deviceInfo,
      };

      return _ajax({
        call: 'secrets',
        urlParameters: '/upload',
        httpType: 'POST',
        responseType: 'json',
        jsonData,
        newAPI: true,
      });
    }

    /*
      function: getSecretGetNonce
      description: get one-time nonce for secret download
      authentication: no
    */
    function getNonceForSecretGet(publicKey) {
      if (!publicKey) {
        throw new Error('input param publicKey can not be empty');
      }

      const jsonData = { userPk: publicKey };

      return _ajax({
        call: 'secrets',
        urlParameters: '/getSecretNonce',
        httpType: 'POST',
        responseType: 'json',
        jsonData,
        newAPI: true,
        timeout: 10 * 1000,
      });
    }

    /*
      function: getSecret
      description: download secret
      authentication: no
    */
    function getSecret(signature, nonce) {
      if (!signature || !nonce) {
        throw new Error('input sign or nonce is invalid.');
      }

      const jsonData = {
        signature,
        nonce,
      };

      return _ajax({
        call: 'secrets',
        urlParameters: '/getSecret',
        httpType: 'POST',
        responseType: 'json',
        jsonData,
        newAPI: true,
        timeout: 10 * 1000,
      });
    }

    function getDirectoryProfile() {
      const path = URL_CALLS['directoryV3'] + '/profile';

      return _request(path, undefined, {
        serverType: SERVICE_LIST.CHAT,
        type: 'GET',
      });
    }

    function requestBindVerificationEmail(email, nonce) {
      if (!email || typeof email !== 'string') {
        throw new Error('email must be a valid string');
      }

      const jsonData = { email };

      if (nonce) {
        Object.assign(jsonData, { nonce });
      }

      return _ajax({
        call: 'authV2',
        urlParameters: '/bind/send',
        httpType: 'POST',
        responseType: 'json',
        jsonData,
        newAPI: true,
      });
    }

    function bindEmail(email, code, nonce) {
      if (!email || typeof email !== 'string') {
        throw new Error('email must be a valid string');
      }

      if (!code || typeof code !== 'string') {
        throw new Error('verification code must be a valid string');
      }

      const jsonData = { email, verificationCode: code };

      if (nonce) {
        Object.assign(jsonData, { nonce });
      }

      return _ajax({
        call: 'authV2',
        urlParameters: '/bind/verification',
        httpType: 'POST',
        responseType: 'json',
        jsonData,
        newAPI: true,
      });
    }

    function requestBindVerificationSMS(phoneNumber, nonce) {
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        throw new Error('phoneNumber must be a valid string');
      }

      const jsonData = { phone: phoneNumber };

      if (nonce) {
        Object.assign(jsonData, { nonce });
      }

      return _ajax({
        call: 'authV2',
        urlParameters: '/bind/sms/send',
        httpType: 'POST',
        responseType: 'json',
        jsonData,
        newAPI: true,
      });
    }

    function bindPhone(phoneNumber, code, nonce) {
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        throw new Error('phoneNumber must be a valid string');
      }

      if (!code || typeof code !== 'string') {
        throw new Error('verification code must be a valid string');
      }

      const jsonData = { phone: phoneNumber, verificationCode: code };

      if (nonce) {
        Object.assign(jsonData, { nonce });
      }

      return _ajax({
        call: 'authV2',
        urlParameters: '/bind/sms/verification',
        httpType: 'POST',
        responseType: 'json',
        jsonData,
        newAPI: true,
      });
    }

    /*
        new call
    */
    // start call
    function startCall(callData) {
      if (!isObject(callData)) {
        throw new Error('invalid call data passed in');
      }

      const jsonData = {};
      const assignJsonData = newObj => Object.assign(jsonData, newObj);

      const criticalMap = {
        type: isNonEmptyString,
        version: isNumber,
        timestamp: isNumber,
        publicKey: isNonEmptyString,
        encInfos: isArray,
        notification: isObject,
        cipherMessages: isArray,
      };

      const criticalWrapper = (key, validator) => {
        const value = callData[key];
        if (!validator(value)) {
          throw new Error(`invalid call field ${key}`);
        }

        assignJsonData({ [key]: value });
      };

      validateMap(criticalMap, criticalWrapper);

      const optionalMap = {
        conversation: isNonEmptyString,
        encMeta: isObject,
      };

      const optionalWrapper = (key, validator) => {
        const value = callData[key];
        if (validator(value)) {
          assignJsonData({ [key]: value });
        }
      };

      validateMap(optionalMap, optionalWrapper);

      const options = {
        serverType: SERVICE_LIST.CALL,
        type: 'POST',
      };

      const path = URL_CALLS.call + '/start';
      return _request(path, jsonData, options);
    }

    // join an existing call
    function joinCall(callData) {
      if (!isObject(callData)) {
        throw new Error('invalid call data passed in');
      }

      const jsonData = {};
      const assignJsonData = newObj => Object.assign(jsonData, newObj);

      const criticalMap = {
        type: isNonEmptyString,
        version: isNumber,
        timestamp: isNumber,
        roomId: isNonEmptyString,
      };

      const criticalWrapper = (key, validator) => {
        const value = callData[key];
        if (!validator(value)) {
          throw new Error(`invalid call field ${key}`);
        }

        assignJsonData({ [key]: value });
      };

      validateMap(criticalMap, criticalWrapper);

      const options = {
        serverType: SERVICE_LIST.CALL,
        type: 'POST',
      };

      const path = URL_CALLS.call + '/start';
      return _request(path, jsonData, options);
    }

    // invite call
    function inviteCall(callData) {
      if (!isObject(callData)) {
        throw new Error('invalid call data passed in');
      }

      const jsonData = {};
      const assignJsonData = newObj => Object.assign(jsonData, newObj);

      const criticalMap = {
        roomId: isNonEmptyString,
        timestamp: isNumber,
      };

      const criticalWrapper = (key, validator) => {
        const value = callData[key];
        if (!validator(value)) {
          throw new Error(`invalid call field ${key}`);
        }

        assignJsonData({ [key]: value });
      };

      validateMap(criticalMap, criticalWrapper);

      const optionalMap = {
        publicKey: isNonEmptyString,
        encInfos: isArray,
        notification: isObject,
        cipherMessages: isArray,
      };

      const optionalWrapper = (key, validator) => {
        const value = callData[key];
        if (validator(value)) {
          assignJsonData({ [key]: value });
        }
      };

      validateMap(optionalMap, optionalWrapper);

      const options = {
        serverType: SERVICE_LIST.CALL,
        type: 'POST',
      };

      const path = URL_CALLS.call + '/invite';
      return _request(path, jsonData, options);
    }

    // list calls
    function listCalls() {
      const options = {
        serverType: SERVICE_LIST.CALL,
        type: 'GET',
      };

      const path = URL_CALLS.call;
      return _request(path, {}, options);
    }

    function checkCall(roomId) {
      if (!roomId) {
        throw new Error('roomId is required');
      }

      const options = {
        serverType: SERVICE_LIST.CALL,
        type: 'GET',
      };

      const path = URL_CALLS.call + '/check?roomId=' + roomId;
      return _request(path, {}, options);
    }

    // control message
    function controlCall(callData) {
      if (!isObject(callData)) {
        throw new Error('invalid call data passed in');
      }

      const jsonData = {};
      const assignJsonData = newObj => Object.assign(jsonData, newObj);

      const criticalMap = {
        roomId: isNonEmptyString,
        timestamp: isNumber,
      };

      const criticalWrapper = (key, validator) => {
        const value = callData[key];
        if (!validator(value)) {
          throw new Error(`invalid call field ${key}`);
        }

        assignJsonData({ [key]: value });
      };

      validateMap(criticalMap, criticalWrapper);

      const optionalMap = {
        cipherMessages: isArray,
        detailMessageType: isNumber,
      };

      const optionalWrapper = (key, validator) => {
        const value = callData[key];
        if (validator(value)) {
          assignJsonData({ [key]: value });
        }
      };

      validateMap(optionalMap, optionalWrapper);

      const options = {
        serverType: SERVICE_LIST.CALL,
        type: 'POST',
      };
      const path = URL_CALLS.call + '/controlmessages';
      return _request(path, jsonData, options);
    }

    function getCallServiceUrls() {
      return _request(
        URL_CALLS.call + '/serviceurl',
        {},
        {
          serverType: SERVICE_LIST.CALL,
          type: 'GET',
        }
      );
    }

    async function getCallToken(forceRefresh = false) {
      return await _getOrRefreshToken(forceRefresh);
    }

    async function submitCallFeedback(data) {
      const options = {
        serverType: SERVICE_LIST.CALL,
        type: 'POST',
      };

      const path = URL_CALLS.call + '/feedback';
      return _request(path, data, options, false);
    }

    function speechToText(jsonData) {
      const options = {
        serverType: SERVICE_LIST.SPEECH2TEXT,
        type: 'POST',
      };

      const path = 'whisperX/transcribe';

      return _request(path, jsonData, options);
    }
  }
}

window.getGlobalWebApiUrls = () => globalWebApiUrls;
