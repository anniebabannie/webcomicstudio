import React from 'react';
import { ButtonBase } from './ButtonBase';
import type { ButtonBaseProps } from './ButtonBase';

// Primary button variant: supplies all styling (layout, spacing, colors, state).
// Consumers can extend by composing this or creating new variant files.
export interface ButtonPrimaryProps extends ButtonBaseProps {
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

function sizeClasses(size: 'sm' | 'md' | 'lg' = 'md') {
  switch (size) {
    case 'sm': return 'px-3 py-2 text-sm';
    case 'lg': return 'px-6 py-3 text-base';
    default: return 'px-4 py-2.5 text-sm';
  }
}

export function ButtonPrimary({ size = 'md', fullWidth, className, ...rest }: ButtonPrimaryProps) {
  return (
    <ButtonBase
      {...rest}
      className={[
        'inline-flex items-center justify-center rounded-md font-medium',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        'text-white shadow-sm',
        'bg-gradient-to-b from-[#7A3DC4] to-[#5237BF] hover:from-[#6935B4] hover:to-[#432FA3]',
        sizeClasses(size),
        fullWidth ? 'w-full' : '',
        className,
      ].filter(Boolean).join(' ')}
    />
  );
}

export default ButtonPrimary;
