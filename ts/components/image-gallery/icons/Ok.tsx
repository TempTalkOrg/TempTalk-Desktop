import React from 'react';

export const Ok = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      viewBox="0 0 18 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        data-follow-stroke="currentColor"
        d="m1.498 6 5 5 10-10"
        stroke="currentColor"
        strokeWidth="1.67"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
