import * as React from 'react';
import { forwardRef } from 'react';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface MemberListButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const MemberListButton = forwardRef<
  HTMLButtonElement,
  MemberListButtonProps
>(function MemberListButton({ onClick, children }: MemberListButtonProps, ref) {
  return (
    <button ref={ref} className="member-list-button" onClick={onClick}>
      {children}
    </button>
  );
});
