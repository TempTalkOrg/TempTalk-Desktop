// construct proto object

const CallType = {
  OneOnOne: '1on1',
  Group: 'group',
  Instant: 'instant',
};

const CallActionType = {
  StartCall: 'start-call',
  InviteMembers: 'invite-members',
  CriticalAlert: 'critical-alert',
};

const CallControlType = {
  StartCall: 'start-call',
  InviteMembers: 'invite-members',
};

class CallMessage {
  #callMessage;
  #calling;
  #joined;
  #cancel;
  #reject;
  #hangup;

  toArrayBuffer;

  constructor(options) {
    const { calling, joined, cancel, reject, hangup } = options || {};

    this.#calling = calling;
    this.#joined = joined;
    this.#cancel = cancel;
    this.#reject = reject;
    this.#hangup = hangup;

    if (this.#calling) {
      this.toArrayBuffer = this.#toCallingAB.bind(this);
    } else if (this.#joined) {
      this.toArrayBuffer = this.#toCtrlAB.bind(this, 'joined');
    } else if (this.#cancel) {
      this.toArrayBuffer = this.#toCtrlAB.bind(this, 'cancel');
    } else if (this.#reject) {
      this.toArrayBuffer = this.#toCtrlAB.bind(this, 'reject');
    } else if (this.#hangup) {
      this.toArrayBuffer = this.#toCtrlAB.bind(this, 'hangup');
    } else {
      throw new Error('unknown call type');
    }
  }

  #newCallingProto() {
    const calling = this.#calling;
    if (!calling) {
      throw new Error('there must be a valid calling');
    }

    /*
      roomId          = 1
      conversationId  = 2
      roomName        = 3
      caller          = 4
    */
    const { roomId, roomName, caller } = calling;

    const { CallMessage } = textsecure.protobuf;
    const { Calling } = CallMessage;

    const proto = new Calling({
      roomId,
      roomName,
      caller,
    });

    return new CallMessage({ calling: proto });
  }

  #newJoinedProto() {
    const joined = this.#joined;
    if (!joined) {
      throw new Error('there must be a valid joined');
    }

    const { roomId } = joined;

    const { CallMessage } = textsecure.protobuf;
    const { Joined } = CallMessage;

    return new CallMessage({ joined: new Joined({ roomId }) });
  }

  #newCancelProto() {
    const cancel = this.#cancel;
    if (!cancel) {
      throw new Error('there must be a valid cancel');
    }

    const { roomId } = cancel;

    const { CallMessage } = textsecure.protobuf;
    const { Cancel } = CallMessage;

    return new CallMessage({ cancel: new Cancel({ roomId }) });
  }

  #newRejectProto() {
    const reject = this.#reject;
    if (!reject) {
      throw new Error('there must be a valid reject');
    }

    const { roomId } = reject;

    const { CallMessage } = textsecure.protobuf;
    const { Reject } = CallMessage;

    return new CallMessage({ reject: new Reject({ roomId }) });
  }

  #newHangupProto() {
    const hangup = this.#hangup;
    if (!hangup) {
      throw new Error('there must be a valid hangup');
    }

    const { roomId } = hangup;

    const { CallMessage } = textsecure.protobuf;
    const { Hangup } = CallMessage;

    return new CallMessage({ hangup: new Hangup({ roomId }) });
  }

  toProto() {
    if (this.#callMessage instanceof textsecure.protobuf.CallMessage) {
      return this.#callMessage;
    }

    let callMessage;

    if (this.#calling) {
      callMessage = this.#newCallingProto();
    } else if (this.#joined) {
      callMessage = this.#newJoinedProto();
    } else if (this.#cancel) {
      callMessage = this.#newCancelProto();
    } else if (this.#reject) {
      callMessage = this.#newRejectProto();
    } else if (this.#hangup) {
      callMessage = this.#newHangupProto();
    } else {
      throw new Error('unknown call type');
    }

    this.#callMessage = callMessage;

    return this.#callMessage;
  }

  #toCallingAB(options) {
    const {
      emk,
      publicKey,
      conversationId,
      createCallMsg,
      controlType,
      callees,
      timestamp,
    } = options || {};
    if (!emk || !publicKey) {
      throw new Error('invalid caller key passed in');
    }

    const callMessage = this.toProto();

    const callingProto = callMessage.calling;
    if (!callingProto) {
      throw new Error('there is not valid calling options');
    }
    /*
      conversationId  = 2
      emk             = 5
      publicKey       = 6
      createCallMsg   = 7;
      controlType     = 8;
      callees         = 9;
      timestamp       = 10;
    */
    callingProto.setEmk(emk);
    callingProto.setPublicKey(publicKey);
    callingProto.setCreateCallMsg(createCallMsg);
    callingProto.setControlType(controlType);
    callingProto.setCallees(callees);
    callingProto.setTimestamp(timestamp);

    const { number, groupId } = conversationId || {};
    if (number) {
      callingProto.setConversationId({ number });
    } else if (groupId) {
      callingProto.setConversationId({ groupId: bufferToAB(groupId) });
    }

    const content = new textsecure.protobuf.Content({ callMessage });
    return content.toArrayBuffer();
  }

  #toCtrlAB(ctrlName) {
    const callMessage = this.toProto();
    const ctrl = callMessage[ctrlName];

    if (!ctrl) {
      throw new Error(`there is not valid ctrl ${ctrlName}`);
    }

    const content = new textsecure.protobuf.Content({ callMessage });
    return content.toArrayBuffer();
  }
}

class CallSender {
  #server;

  constructor(username, password) {
    this.#server = WebAPI.connect({ username, password });
  }

  async listCalls() {
    return await this.#server.listCalls();
  }

  async checkCall(roomId) {
    return await this.#server.checkCall(roomId);
  }

  /*
    options:
      conversationId?: {
        number?: string;
        groupId?: string;
      };
      roomName?: string;
      type: string;
      version: number;
      timestamp: number;
      callees: string[];
      collapseId: string;
      ourNumber: string;
      needSync?: boolean;
  */
  async startCall(options, roomCipher) {
    if (!(roomCipher instanceof CallRoomCipher)) {
      throw new Error('invalid param: roomCipher');
    }

    const { ourNumber, callees } = options || {};
    if (!ourNumber) {
      throw new Error('invalid param: ourNumber');
    }

    if (!Array.isArray(callees) || !callees.length) {
      throw new Error('invalid param: callees');
    }

    // when initialing a new call
    // roomId should be empty
    // and caller must be current user
    const calling = _.pick(options, [
      // 'roomId',
      // 'conversationId',
      'roomName',
      // 'caller',
    ]);

    // caller of startCall must be ourNumber
    calling.caller = ourNumber;

    const callMessage = new CallMessage({ calling });
    const outgoing = new OutgoingCall(
      this.#server,
      { ...options, callMessage },
      roomCipher
    );
    return await outgoing.startCall();
  }

  /*
    options:
      roomId: string;
      type: string;
      version: number;
      timestamp: number;
  */
  async joinCall(options) {
    if (!options?.roomId) {
      throw new Error('invalid param: roomId');
    }

    const outgoing = new OutgoingCall(this.#server, { ...options });
    return await outgoing.joinCall();
  }

  /*
    options:
      roomId: string;
      roomName?: string;
      conversationId?: {
        number?: string;
        groupId?: string;
      };
      caller: string;
      version: number;
      timestamp: number;
      callees: string[];
      collapseId: string;
      controlType: 'start' | 'invite';
      createCallMsg: boolean;
  */
  async inviteCall(options, roomCipher) {
    if (!(roomCipher instanceof CallRoomCipher)) {
      throw new Error('invalid param: roomCipher');
    }

    const { roomId, caller, callees } = options || {};
    if (!roomId) {
      throw new Error('invalid param: roomId');
    }

    if (!caller) {
      throw new Error('invalid param: caller');
    }

    if (!Array.isArray(callees) || !callees.length) {
      throw new Error('invalid param: callees');
    }

    const calling = _.pick(options, [
      'roomId',
      // 'conversationId',
      'roomName',
      'caller',
    ]);

    const callMessage = new CallMessage({ calling });
    const outgoing = new OutgoingCall(
      this.#server,
      { ...options, callMessage, needSync: options.createCallMsg === true },
      roomCipher
    );
    return await outgoing.inviteCall();
  }

  /*
    options:
      roomId: string
      ourNumber: string;
  */
  async syncJoinedCall(options, roomCipher) {
    if (!(roomCipher instanceof CallRoomCipher)) {
      throw new Error('invalid param: roomCipher');
    }

    const { roomId, ourNumber } = options || {};
    if (!ourNumber) {
      throw new Error('invalid param: ourNumber');
    }

    if (!roomId) {
      throw new Error('invalid param: roomId');
    }

    const joined = _.pick(options, ['roomId']);

    const callMessage = new CallMessage({ joined });
    const outgoing = new OutgoingCall(
      this.#server,
      { ...options, callees: [], callMessage, needSync: true },
      roomCipher
    );
    return await outgoing.controlCall();
  }

  /*
    options:
      roomId: string;
      callees: string[];
      collapseId: string;
      type: '1on1' | 'group' | 'instant';
  */
  async cancelCall(options, roomCipher) {
    if (!(roomCipher instanceof CallRoomCipher)) {
      throw new Error('invalid param: roomCipher');
    }

    if (!options?.roomId) {
      throw new Error('invalid param: roomId');
    }

    if (!Array.isArray(callees) || !callees.length) {
      throw new Error('invalid param: callees');
    }

    const cancel = _.pick(options, ['roomId']);

    const callMessage = new CallMessage({ cancel });
    const outgoing = new OutgoingCall(
      this.#server,
      { ...options, callMessage, needSync: false },
      roomCipher
    );
    return await outgoing.controlCall();
  }

  /*
    options:
      roomId: string;
      callees: string[];
      collapseId: string;
      ourNumber: string;
      needSync?: boolean;
      type: '1on1' | 'group' | 'instant';
  */
  async rejectCall(options, roomCipher) {
    if (!(roomCipher instanceof CallRoomCipher)) {
      throw new Error('invalid param: roomCipher');
    }

    const { roomId, ourNumber, callees } = options || {};
    if (!ourNumber) {
      throw new Error('invalid param: ourNumber');
    }

    if (!roomId) {
      throw new Error('invalid param: roomId');
    }

    if (!Array.isArray(callees) || !callees.length) {
      throw new Error('invalid param: callees');
    }

    const reject = _.pick(options, ['roomId']);

    const callMessage = new CallMessage({ reject });
    const outgoing = new OutgoingCall(
      this.#server,
      { ...options, callMessage },
      roomCipher
    );
    return await outgoing.controlCall();
  }

  /*
    options:
      roomId: string;
      callees: string[];
      collapseId: string;
      ourNumber: string;
      needSync?: boolean
      type: '1on1' | 'group' | 'instant';
  */
  async hangupCall(options, roomCipher) {
    if (!(roomCipher instanceof CallRoomCipher)) {
      throw new Error('invalid param: roomCipher');
    }

    const { roomId, ourNumber, callees } = options || {};
    if (!ourNumber) {
      throw new Error('invalid param: ourNumber');
    }

    if (!roomId) {
      throw new Error('invalid param: roomId');
    }

    if (!Array.isArray(callees) || !callees.length) {
      throw new Error('invalid param: callees');
    }

    const hangup = _.pick(options, ['roomId']);

    const callMessage = new CallMessage({ hangup });
    const outgoing = new OutgoingCall(
      this.#server,
      { ...options, callMessage },
      roomCipher
    );
    return await outgoing.controlCall();
  }

  async getServiceUrls() {
    return await this.#server.getCallServiceUrls();
  }

  async getCallToken(forceRefresh) {
    return await this.#server.getCallToken(forceRefresh);
  }

  async submitCallFeedback(data) {
    return await this.#server.submitCallFeedback(data);
  }

  async sendCriticalAlert(data) {
    return await this.#server.sendCriticalAlert(data);
  }
}

// use a wrapper function to filter out
// which functions could be called from outside
class CallSenderWrapper {
  constructor(username, password) {
    const sender = new CallSender(username, password);
    const bindSender = fnName => sender[fnName].bind(sender);

    this.listCalls = bindSender('listCalls');
    this.startCall = bindSender('startCall');
    this.joinCall = bindSender('joinCall');
    this.inviteCall = bindSender('inviteCall');

    this.cancelCall = bindSender('cancelCall');
    this.rejectCall = bindSender('rejectCall');
    this.hangupCall = bindSender('hangupCall');

    this.syncJoinedCall = bindSender('syncJoinedCall');
    this.checkCall = bindSender('checkCall');
    this.getServiceUrls = bindSender('getServiceUrls');
    this.getCallToken = bindSender('getCallToken');
    this.submitCallFeedback = bindSender('submitCallFeedback');
    this.sendCriticalAlert = bindSender('sendCriticalAlert');
  }
}

class CallHelper {
  static generateCallMessageTimestamp(options) {
    let timestamp = options.timestamp;
    const isOutgoing = options.source === options.ourNumber;
    if (options.action === CallActionType.InviteMembers) {
      const index = options.callees.indexOf(
        isOutgoing ? options.id : options.ourNumber
      );
      timestamp += index;
    }
    return timestamp;
  }
}

window.textsecure = window.textsecure || {};
textsecure.CallSender = CallSenderWrapper;
textsecure.CallType = CallType;
textsecure.CallActionType = CallActionType;
textsecure.CallControlType = CallControlType;
textsecure.CallHelper = CallHelper;
