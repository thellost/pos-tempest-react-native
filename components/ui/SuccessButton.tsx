import clsx from 'clsx';
import { Button, type ButtonProps } from './Button';

interface SuccessButtonProps extends Omit<ButtonProps, 'className'> {
  size?: 'md' | 'lg';
  className?: string;
}

export function SuccessButton({ size = 'md', className, ...rest }: SuccessButtonProps) {
  return (
    <Button
      className={clsx(
        'items-center justify-center rounded-sm border border-pos-success bg-pos-success',
        size === 'lg' ? 'h-12' : 'h-10',
        className,
      )}
      {...rest}
    />
  );
}
