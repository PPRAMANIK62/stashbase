import crypto from 'node:crypto';

export function processPrivateTokenMatches(
  actual: string | undefined,
  expected: string,
): boolean {
  if (!actual || !expected) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
