export function nextSequentialId(prefix: string, existing: string[]) {
  const used = new Set(existing);
  let i = 1;
  while (used.has(`${prefix}_${i}`)) i++;
  return `${prefix}_${i}`;
}
