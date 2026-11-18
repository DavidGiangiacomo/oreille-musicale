import { toggleButton } from '../styles';

interface OptionGroupProps<T extends string> {
  legend: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}

/** Groupe d'options exclusives, présenté comme des boutons à bascule. */
export function OptionGroup<T extends string>({
  legend,
  value,
  options,
  onChange,
}: OptionGroupProps<T>) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">
        {legend}
      </legend>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className={toggleButton}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
