export const startOfMonth = (date = new Date()): Date =>
  new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);

export const endOfMonth = (date = new Date()): Date =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

export const addDays = (date: Date, days: number): Date => {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
};

export const startOfPreviousMonth = (date = new Date()): Date =>
  new Date(date.getFullYear(), date.getMonth() - 1, 1, 0, 0, 0, 0);

export const endOfPreviousMonth = (date = new Date()): Date =>
  new Date(date.getFullYear(), date.getMonth(), 0, 23, 59, 59, 999);

export const parsePlaidDate = (input?: string | null): Date | null => {
  if (!input) {
    return null;
  }

  const parsed = new Date(`${input}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

