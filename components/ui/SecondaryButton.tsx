import clsx from 'clsx';
import { Button, type ButtonProps } from './Button';

interface SecondaryButtonProps extends Omit<ButtonProps, 'className'> {
  size?: 'md' | 'lg';
  className?: string;
}

export function SecondaryButton({ size = 'md', className, ...rest }: SecondaryButtonProps) {
  return (
    <Button
      className={clsx(
        'items-center justify-center rounded-sm border border-border bg-surface-raised',
        size === 'lg' ? 'h-12' : 'h-10',
        className,
      )}
      {...rest}
    />
  );
}
