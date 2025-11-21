import React from 'react';
import { Link } from 'react-router';

// Ultra-minimal base: no padding, colors, radius, typography assumptions.
// Provides only semantic rendering (button vs link) + disabled logic + passthrough className.
export interface ButtonBaseProps {
  children: React.ReactNode;
  to?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  className?: string; // Variants supply all styling.
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

export function ButtonBase({
  children,
  to,
  type = 'button',
  disabled,
  className,
  onClick,
}: ButtonBaseProps) {
  // Do NOT add opinionated base classes; variants will.
  const cls = className || '';

  if (to) {
    return (
      <Link to={to} className={cls + " cursor-pointer"} aria-disabled={disabled} onClick={(e) => disabled ? e.preventDefault() : undefined}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={cls + " cursor-pointer"} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

export default ButtonBase;
