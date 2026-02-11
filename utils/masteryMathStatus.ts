
export const getTAPRStatus = (tapr: number) => {
  if (tapr < 0.8) return { label: 'Behind', color: 'text-rose-500', bg: 'bg-rose-50' };
  if (tapr > 1.2) return { label: 'Ahead', color: 'text-emerald-500', bg: 'bg-emerald-50' };
  return { label: 'On Pace', color: 'text-amber-500', bg: 'bg-amber-50' };
};
