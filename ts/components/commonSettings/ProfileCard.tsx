import React, { useEffect, useMemo, useState } from 'react';
import { Profile } from './Profile';
import { LocalizerType } from '../../types/Util';
import { useMemoizedFn } from 'ahooks';
import {
  getConversationModel,
  getConversationProps,
  getOrCreateConversationModel,
} from '../../shims/Whisper';
import { isEqual } from 'lodash';
import { StateType } from '../../state/reducer';
import { UserStorage } from '../../shims/storage';
import { trigger } from '../../shims/events';
import { API_STATUS } from '../../types/APIStatus';

type PropsType = {
  id: string;
  i18n: LocalizerType;
  onClose: () => void;
  shareId?: string;
  avatarPath?: string;
  conversationId?: string;
  allowUpload?: boolean;
};

// const signLengthMax = 80;

export const ProfileCard = (props: PropsType) => {
  const { i18n, id, onClose, shareId, conversationId } = props;
  const [isBot, setIsBot] = useState(undefined);
  const [remarkName, setRemarkName] = useState('');
  const [userInfo, setUserInfo] = useState<any>(undefined);

  const updateUserInfoState = useMemoizedFn((id: string) => {
    if (!id) {
      return;
    }

    const conversation = getConversationModel(id);
    if (!conversation) {
      return;
    }

    setRemarkName(conversation.getRemarkName());
    setIsBot(conversation.isBot());

    if (!isEqual(conversation.format(), userInfo)) {
      setUserInfo(conversation.format());
    }
  });

  const onClickCommonGroups = useMemoizedFn((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const currOpenedId = (window as any).getCurrentOpenConversation();
    if (!currOpenedId) {
      return;
    }

    const model = getConversationModel(currOpenedId);
    if (!model) {
      return;
    }

    model.trigger('showCommonGroups', id);

    onClose?.();
  });

  const initData = useMemoizedFn(async () => {
    const conversation = await getOrCreateConversationModel(id, 'private');
    if (!conversation) {
      return;
    }

    updateUserInfoState(id);

    setTimeout(async () => {
      await conversation.throttledForceUpdatePrivateContact();
      updateUserInfoState(id);
    }, 0);
  });

  const onCloseUserProfile = useMemoizedFn(() => {
    props.onClose?.();
  });

  useEffect(() => {
    initData();

    window.addEventListener('event-close-user-profile', onCloseUserProfile);

    return () => {
      window.removeEventListener(
        'event-close-user-profile',
        onCloseUserProfile
      );
    };
  }, []);

  const commonGroupNumber = useMemo(() => {
    const state = (window as any).inboxStore.getState();
    const { memberGroupLookup } = (state as StateType).conversations;

    const groupList = memberGroupLookup[id] || [];

    return groupList
      .map(id => getConversationProps(id))
      .filter(props => props.isAliveGroup).length;
  }, [id]);

  const openCall = useMemoizedFn((e: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    const theUser = getConversationModel(id);
    if (!theUser || !theUser.isDirectoryUser()) {
      return alert(i18n('different_subteam_error'));
    }

    trigger('showConversation', id);
    const myEvent = new Event('event-toggle-switch-chat');
    window.dispatchEvent(myEvent);

    const username = (window as any).textsecure.storage.get('number_id');
    const password = (window as any).textsecure.storage.get('password');
    const deviceId = UserStorage.getDeviceId();

    const ourNumber = UserStorage.getNumber();
    const roomName = theUser.cachedProps.name;
    const ourName: string = getConversationModel(ourNumber!).getName();

    (window as any).dispatchCallMessage('startCall', {
      isPrivate: true,
      roomName,
      ourName,
      number: theUser.id,
      username,
      password,
      type: '1on1',
      deviceId,
      criticalAlert: theUser.isCriticalAlertEnabled(),
    });

    onClose?.();
  });

  const addFriend = useMemoizedFn(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const model = getConversationModel(id);
    try {
      let source = null;
      if (shareId) {
        source = {
          uid: shareId,
          type: 'shareContact',
        };
      } else if (conversationId) {
        source = {
          groupID: conversationId,
          type: 'fromGroup',
        };
      }

      await model.sendFriendRequest(source);
      (window as any).noticeSuccess(i18n('friendRequestSent'));

      model.forceSendMessageAuto(
        i18n('friendRequest'),
        null,
        [],
        null,
        null,
        null,
        null,
        null,
        null,
        null
      );

      onClose?.();
    } catch (e: any) {
      let errorMessage = '';
      switch (e?.response?.status) {
        case API_STATUS.AccountLoggedOut:
          errorMessage = i18n('addFriendError.accountLoggedOut');
          break;
        default:
          errorMessage = 'network error';
      }
      (window as any).noticeError(errorMessage);
    }
  });

  const deleteContact = useMemoizedFn(async () => {
    if (!id) {
      return;
    }

    try {
      const model = getConversationModel(id);
      await model?.deleteFriendship();
    } catch (error) {
      (window as any).noticeError('network error');

      console.log(
        'Failed to successfully delete conversation after delete contact',
        error
      );
    }
  });

  const actions = useMemo(() => {
    if (isBot === undefined) {
      return {};
    }
    return {
      startCall: !userInfo?.isMe && !isBot && userInfo?.directoryUser,
      shareContact: userInfo?.directoryUser,
      addFriend: !userInfo?.directoryUser,
      deleteContact: !isBot && userInfo?.directoryUser,
      editRemark: true,
    };
  }, [isBot, userInfo]);

  const onOpenChat = useMemoizedFn(() => {
    let conversationFrom = null;
    if (shareId) {
      conversationFrom = {
        uid: shareId,
        type: 'shareContact',
      };
    }

    trigger(
      'showConversation',
      userInfo?.id,
      null,
      null,
      null,
      conversationFrom
    );
    const myEvent = new Event('event-toggle-switch-chat');
    window.dispatchEvent(myEvent);
    onClose?.();
  });

  const onEditRemarkName = useMemoizedFn(async (newRemarkName: string) => {
    const conversation = (window as any).ConversationController.get(id);
    if (!conversation) {
      return false;
    }
    await conversation.setRemarkName(newRemarkName);

    return true;
  });

  const onShareContact = useMemoizedFn(() => {
    const number = userInfo?.id;
    const name = userInfo?.accountName;
    if (number) {
      const myEvent = new CustomEvent('event-share-user-contact', {
        detail: { number, name },
      });
      window.dispatchEvent(myEvent);
      onClose?.();
    }
  });

  return (
    <Profile
      i18n={i18n}
      userInfo={userInfo}
      remarkName={remarkName}
      commonGroupNumber={commonGroupNumber}
      onClickCommonGroups={onClickCommonGroups}
      // bottom operations
      onStartCall={openCall}
      onAddFriend={addFriend}
      onDeleteContact={deleteContact}
      actions={actions}
      onOpenChat={onOpenChat}
      onEditRemarkName={onEditRemarkName}
      onShareContact={onShareContact}
    ></Profile>
  );
};
