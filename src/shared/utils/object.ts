export function areSetsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;

  let equal = true;

  a.forEach(value => {
    if (!b.has(value)) equal = false;
  });

  return equal;
}