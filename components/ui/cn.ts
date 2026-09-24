/** Joins truthy class names. Later classes are appended, not merged. */
export const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');
