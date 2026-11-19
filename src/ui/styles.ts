// Classes partagées de l'interface (Tailwind).

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500';

export const card =
  'flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800';

export const cardTitle = 'text-lg font-semibold';

export const primaryButton = `min-h-12 rounded-xl bg-slate-900 px-6 font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-60 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300 ${focusRing}`;

export const secondaryButton = `min-h-12 rounded-xl border border-slate-300 px-5 font-medium transition-colors hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800 ${focusRing}`;

/** Bouton d'un groupe d'options ; l'option choisie porte `aria-pressed`. */
export const toggleButton = `min-h-12 rounded-xl border border-slate-300 px-1.5 text-[13px] leading-tight font-medium sm:px-3 sm:text-sm transition-colors aria-pressed:border-amber-500 aria-pressed:bg-amber-50 aria-pressed:text-amber-900 dark:border-slate-700 dark:aria-pressed:bg-amber-950 dark:aria-pressed:text-amber-100 ${focusRing}`;

export const muted = 'text-slate-600 dark:text-slate-400';
