import { Link } from 'react-router';
import { muted } from '../styles';

/** En-tête d'écran : lien de retour, titre, et une information à droite. */
export function ScreenHeader({
  backTo,
  backLabel,
  title,
  aside,
  subtitle,
}: {
  backTo: string;
  backLabel: string;
  title: string;
  aside?: string;
  subtitle?: string;
}) {
  return (
    <header className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Link
          to={backTo}
          className="rounded-lg py-1 font-medium underline-offset-4 hover:underline"
        >
          <span aria-hidden="true">← </span>
          {backLabel}
        </Link>
        {aside && <span className={`${muted} tabular-nums`}>{aside}</span>}
      </div>
      <h1 className="text-2xl font-bold">{title}</h1>
      {subtitle && <p className={muted}>{subtitle}</p>}
    </header>
  );
}

export function ProgressBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
    >
      <div
        className="h-full rounded-full bg-amber-500 transition-[width]"
        style={{ width: `${max === 0 ? 0 : (value / max) * 100}%` }}
      />
    </div>
  );
}

export function SaveFailedAlert() {
  return (
    <p role="alert" className="text-sm text-red-700 dark:text-red-300">
      Tes réponses n'ont pas pu être enregistrées sur cet appareil.
    </p>
  );
}
