import * as React from 'react';
import { forwardRef } from 'react';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AddMemberButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const AddMemberButton = forwardRef<
  HTMLButtonElement,
  AddMemberButtonProps
>(function AddMemberButton({ children, onClick }: AddMemberButtonProps, ref) {
  return (
    <button ref={ref} className="add-member-button" onClick={onClick}>
      {children}
    </button>
  );
});
