import clsx from 'clsx';
import { Button, type ButtonProps } from './Button';

interface PrimaryButtonProps extends Omit<ButtonProps, 'className'> {
  size?: 'md' | 'lg';
  className?: string;
}

export function PrimaryButton({ size = 'md', className, ...rest }: PrimaryButtonProps) {
  return (
    <Button
      className={clsx(
        'items-center justify-center rounded-sm border border-accent bg-accent',
        size === 'lg' ? 'h-12' : 'h-10',
        className,
      )}
      {...rest}
    />
  );
}
