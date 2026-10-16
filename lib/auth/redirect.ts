/** Only allow root-relative paths on the current website. */
export function safeReturnPath(value: string | null | undefined): string {
  if (!value?.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return '/';
  const origin = 'https://return-path.invalid';
  const url = new URL(value, origin);
  if (url.origin !== origin || url.pathname.startsWith('//')) return '/';
  return `${url.pathname}${url.search}${url.hash}`;
}
