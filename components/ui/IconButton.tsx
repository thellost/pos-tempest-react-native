import clsx from 'clsx';
import { Button, type ButtonProps } from './Button';

interface IconButtonProps extends Omit<ButtonProps, 'className'> {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASS = {
  sm: 'h-5 w-5 items-center justify-center rounded-sm',
  md: 'h-8 w-8 items-center justify-center rounded-sm',
  lg: 'h-10 w-10 items-center justify-center rounded-sm',
} as const;

export function IconButton({ size = 'md', className, ...rest }: IconButtonProps) {
  return (
    <Button
      pressScale={1}
      className={clsx(SIZE_CLASS[size], className)}
      {...rest}
    />
  );
}
