import { useCountDown, useMemoizedFn } from 'ahooks';
import { useEffect, useRef, useState } from 'react';
import { LocalizerType } from '../../../types/Util';
import playAudio from '../PlayAudio';

const mainWindow: any = window;

export const useIncomingCall = ({ i18n }: { i18n: LocalizerType }) => {
  const globalInComingRef = useRef<any>(null);
  const [name, setName] = useState('');
  const [avatarPath, setAvatarPath] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [renderDefaultAvatar, setRenderDefaultAvatar] = useState(false);
  const [accountName, setAccountName] = useState('');

  const setupIncomingCall = useMemoizedFn(() => {
    globalInComingRef.current = mainWindow.getIncomingCallInfo();

    console.log(
      'incoming call window created, roomId:',
      globalInComingRef.current.roomId
    );

    const audioType = globalInComingRef.current.isPrivate
      ? 'call-passive-private'
      : 'call-passive';
    playAudio(audioType);

    setRenderDefaultAvatar(globalInComingRef.current.type === 'group');
  });

  const handleSearchUser = useMemoizedFn((info: any) => {
    if (
      info.id !== globalInComingRef.current.groupId &&
      info.id !== globalInComingRef.current.caller
    ) {
      return;
    }
    if (globalInComingRef.current.type !== 'group') {
      setName(info.name || '');
      setAccountName(info.accountName || '');
      setAvatarPath(info.avatar || '');
      if (globalInComingRef.current.type === '1on1') {
        globalInComingRef.current.roomName = info.name;
      }
    } else {
      if (info.id === globalInComingRef.current.groupId) {
        setName(info.name || '');
        setAccountName(info.accountName || '');
        setAvatarPath(info.avatar || '');
        setRenderDefaultAvatar(true);
      } else {
        setInviteName(info.name || '');
      }
    }
  });

  useEffect(() => {
    setupIncomingCall();
    mainWindow.registerSearchUser(handleSearchUser);
    mainWindow.searchUser(globalInComingRef.current.caller);
    if (globalInComingRef.current.type === 'group') {
      mainWindow.searchUser(globalInComingRef.current.groupId);
    }
  }, []);

  const onCountdownEnd = useMemoizedFn(() => {
    mainWindow.wantCloseSelf();
  });

  useCountDown({
    leftTime: 56 * 1000,
    onEnd: onCountdownEnd,
  });

  const onReject = useMemoizedFn(() => {
    console.log('incoming call reject button clicked.');
    mainWindow.acceptOrReject(false, globalInComingRef.current);
    mainWindow.wantCloseSelf();
  });

  const onAccept = useMemoizedFn(async () => {
    console.log('incoming call accept button clicked.');
    if (await mainWindow.isCallingExist()) {
      console.log('incoming call accept callWindow already exist.');
      window.alert(i18n('incomingCallAlreadyExist'));
      return;
    }

    mainWindow.acceptOrReject(true, globalInComingRef.current);
    // 拉入预进入会议
    mainWindow.joinCallFromIncoming(
      globalInComingRef.current.caller,
      globalInComingRef.current.roomName,
      globalInComingRef.current.isPrivate,
      {
        ...globalInComingRef.current,
      }
    );
    mainWindow.wantCloseSelf();
  });

  return {
    name,
    accountName,
    inviteName,
    avatarPath,
    renderDefaultAvatar,
    onReject,
    onAccept,
  };
};
