import clsx from 'clsx';
import { Button, type ButtonProps } from './Button';

interface DangerButtonProps extends Omit<ButtonProps, 'className'> {
  size?: 'md' | 'lg';
  className?: string;
}

export function DangerButton({ size = 'md', className, ...rest }: DangerButtonProps) {
  return (
    <Button
      className={clsx(
        'items-center justify-center rounded-sm border border-pos-danger bg-pos-danger-muted',
        size === 'lg' ? 'h-12' : 'min-h-[44px]',
        className,
      )}
      {...rest}
    />
  );
}
