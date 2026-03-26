import * as React from 'react';
import { useFeatureContext } from '../../context';
import { useMemoizedFn } from 'ahooks';
import { useLocalParticipant } from '../../hooks';
import { forwardRef, useMemo } from 'react';
import classNames from 'classnames';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RaiseHandButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const RaiseHandButton = forwardRef<
  HTMLButtonElement,
  RaiseHandButtonProps
>(function RaiseHandButton(props: RaiseHandButtonProps, ref) {
  const featureFlags = useFeatureContext();
  const { localParticipant } = useLocalParticipant();

  const isRaised = useMemo(() => {
    return featureFlags?.raiseHandList?.some(
      item => item.identity === localParticipant?.identity
    );
  }, [featureFlags?.raiseHandList, localParticipant?.identity]);

  const onClick = useMemoizedFn(async () => {
    if (!featureFlags || !localParticipant) return;
    try {
      if (isRaised) {
        await featureFlags.cancelHand([localParticipant.identity]);
      } else {
        await featureFlags.raiseHand();
      }
    } catch (e) {
      console.log('raise hand button click error', e);
    }
  });

  return (
    <button
      ref={ref}
      className={classNames([
        'raise-hand-button',
        {
          'is-raised': isRaised,
        },
      ])}
      onClick={onClick}
    >
      {props.children}
    </button>
  );
});
