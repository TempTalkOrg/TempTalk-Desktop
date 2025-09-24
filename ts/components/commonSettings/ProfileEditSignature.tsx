import React, { useEffect, KeyboardEvent } from 'react';

type TextAreaProps = {
  content: string;
  editName: boolean;
  className?: string;
  onComplete: (text: string | undefined) => void;
};

const ProfileEditSignature = (props: TextAreaProps) => {
  const textareaRef: React.RefObject<HTMLTextAreaElement> = React.createRef();
  const signLengthMax = 80;
  const nameLengthMax = 30;

  useEffect(() => {
    (window as any).autosize(textareaRef.current);
    textareaRef.current?.focus();
    textareaRef.current?.setSelectionRange(-1, -1);
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e?.key === 'Enter' || e?.key === 'Escape') {
      props?.onComplete(textareaRef?.current?.value);
    }
  };

  const onBlur = () => {
    props?.onComplete(textareaRef?.current?.value);
  };

  let cs = 'signature-input';
  if (props.editName) {
    cs += ' name-input';
  }

  if (props.className) {
    cs = props.className;
  }

  return (
    <textarea
      className={cs}
      ref={textareaRef}
      defaultValue={props.content}
      maxLength={props.editName ? nameLengthMax : signLengthMax}
      spellCheck={false}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    />
  );
};

export default ProfileEditSignature;
