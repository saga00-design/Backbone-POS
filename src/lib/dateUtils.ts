
export const parseFirestoreTimestamp = (val: any): number | null => {
  if (val === undefined || val === null) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && val.toDate && typeof val.toDate === 'function') return val.toDate().getTime();
  if (typeof val === 'object' && val.seconds !== undefined) return val.seconds * 1000;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.getTime();
};
