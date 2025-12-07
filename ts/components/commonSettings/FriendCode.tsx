import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LocalizerType } from '../../types/Util';
import { Avatar } from '../Avatar';
import { ConfigProvider, Progress, QRCode } from 'antd';
import { useMemoizedFn } from 'ahooks';
import { AddFriendModal } from '../AddFriendModal';
import { getConversationModel } from '../../shims/Whisper';

interface IFriendCodeProps {
  avatarPath?: string;
  i18n: LocalizerType;
  name?: string;
  id: string;
  closeSetting: () => void;
}

export const FriendCode = (props: IFriendCodeProps) => {
  const { avatarPath, i18n, name, id, closeSetting } = props;
  const [url, setUrl] = useState(' ');
  const [code, setCode] = useState('');
  const [addFriendModalOpen, setAddFriendModalOpen] = useState(false);
  const [showError, setShowError] = useState(false);

  const codes = useMemo(() => {
    return code.split('');
  }, [code]);

  const [percent, setPercent] = useState(100);
  const [refresh, setRefresh] = useState(Math.random());
  const joinedAt = useMemo(() => {
    const conversation = getConversationModel(id);
    return conversation?.get('joinedAt') || '';
  }, [id]);

  const ref = useRef(percent);
  ref.current = percent;

  const timestampRef = useRef<number>(-1);
  const rafRef = useRef(-1);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const startAnimation = useMemoizedFn(() => {
    if (ref.current > 0) {
      const currTimestamp = new Date().getTime();
      // delay 0.5s to update randomCode
      const nowPercent =
        100 - ((currTimestamp - timestampRef.current) / (90.5 * 1000)) * 100;
      setPercent(nowPercent);

      timeoutRef.current = setTimeout(() => {
        rafRef.current = requestAnimationFrame(startAnimation);
      }, 100);
    } else {
      setPercent(100);
      setRefresh(Math.random());
      return;
    }
  });

  const fetchFriendCode = useMemoizedFn(async () => {
    try {
      const res = await (window as any).textsecure.messaging.generateInviteCode(
        0,
        0
      );
      setCode(res.randomCode);
      setUrl(res.inviteLink);
      setShowError(res.randomCode === '****');
    } catch (e) {
      console.log(e);
    }
  });

  useEffect(() => {
    timestampRef.current = new Date().getTime();
    rafRef.current = -1;

    startAnimation();
    fetchFriendCode();

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timeoutRef.current);
    };
  }, [refresh]);

  const handleAddFriend = useMemoizedFn(() => {
    setAddFriendModalOpen(true);
  });

  const handleCopyLink = useMemoizedFn(async () => {
    try {
      const text = `Chat with me on Yelling ${url}`;
      await (window as any).copyText(text);
      (window as any).noticeSuccess(i18n('copiedInviteLink'));
    } catch (e) {
      (window as any).noticeError(JSON.stringify(e));
    }
  });

  return (
    <div className="friend-code common-setting">
      <div className="common-setting header-bg"></div>
      <div className="common-setting bottom-bg"></div>
      <div className="common-setting friend-code-name">{name}</div>
      <div className="common-setting friend-code-joined-at">
        {joinedAt} {i18n('addFriend.drawer.joined')}
      </div>
      <div className="common-setting close-button" onClick={closeSetting}>
        <div className="close-button-inner"></div>
      </div>
      <div className="setting-icon">
        <Avatar
          id={id}
          avatarPath={avatarPath}
          conversationType="direct"
          i18n={i18n}
          name={name}
          size={88}
          noClickEvent={true}
        />
      </div>
      <div className="friend-code-container">
        <div className="qrcode-card">
          <QRCode
            value={url ?? 'placeholder'}
            status={url ? 'active' : 'loading'}
            errorLevel="H"
            size={160}
            type="canvas"
            icon="./images/icon_1024.png"
            iconSize={50}
            bgColor="white"
            color="black"
          />
          <div className="friend-code-number">
            {codes.map((code, index) => {
              return (
                <div className="code-number-item" key={index}>
                  {code}
                </div>
              );
            })}
          </div>
          <ConfigProvider
            theme={{
              token: {
                motionDurationSlow: '0s',
              },
            }}
          >
            <Progress
              trailColor="var(--dst-color-text-disable)"
              className="friend-code-refresh-progress"
              percent={percent}
              size={4}
              showInfo={false}
            />
          </ConfigProvider>
        </div>
        {showError && (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--dst-color-text-error)',
              marginTop: 16,
            }}
          >
            Invites full. Please try later!
          </div>
        )}
        <div className="friend-code-operation">
          <div className="enter-code" onClick={handleAddFriend}>
            <div className="enter-code-icon"></div>
            <span>{i18n('addFriend.drawer.enterCode')}</span>
          </div>
          <div className="copy-link" onClick={handleCopyLink}>
            <div className="copy-link-icon"></div>
            <span>{i18n('addFriend.drawer.copyLink')}</span>
          </div>
        </div>
      </div>
      <AddFriendModal
        i18n={i18n}
        open={addFriendModalOpen}
        onCancel={() => {
          setAddFriendModalOpen(false);
        }}
      />
    </div>
  );
};
