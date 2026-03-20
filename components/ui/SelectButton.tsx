import clsx from 'clsx';
import { Button, type ButtonProps } from './Button';

interface SelectButtonProps extends Omit<ButtonProps, 'className'> {
  selected: boolean;
  selectedClassName?: string;
  unselectedClassName?: string;
  className?: string;
}

const DEFAULT_SELECTED = 'border-accent bg-accent/15';
const DEFAULT_UNSELECTED = 'border-border bg-surface';

export function SelectButton({
  selected,
  selectedClassName,
  unselectedClassName,
  className,
  ...rest
}: SelectButtonProps) {
  return (
    <Button
      className={clsx(
        'items-center justify-center rounded-xl border px-4 py-2',
        selected
          ? (selectedClassName ?? DEFAULT_SELECTED)
          : (unselectedClassName ?? DEFAULT_UNSELECTED),
        className,
      )}
      {...rest}
    />
  );
}
