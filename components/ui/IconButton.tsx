import clsx from 'clsx';
import { Button, type ButtonProps } from './Button';

interface IconButtonProps extends Omit<ButtonProps, 'className'> {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASS = {
  sm: 'h-9 w-9 items-center justify-center rounded-sm',
  md: 'h-10 w-10 items-center justify-center rounded-sm',
  lg: 'h-10 w-10 items-center justify-center rounded-sm',
} as const;

// Expand the tappable hit area without changing the visual size of the icon
const SIZE_HITSLOP = {
  sm: { top: 12, bottom: 12, left: 12, right: 12 },
  md: { top: 8, bottom: 8, left: 8, right: 8 },
  lg: { top: 4, bottom: 4, left: 4, right: 4 },
} as const;

export function IconButton({ size = 'md', className, ...rest }: IconButtonProps) {
  return (
    <Button
      pressScale={1}
      hitSlop={SIZE_HITSLOP[size]}
      className={clsx(SIZE_CLASS[size], className)}
      {...rest}
    />
  );
}
