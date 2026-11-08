/**
 * Build the standard Xtream Codes playlist URL from credentials the owner
 * already holds. Many providers hand out a server address, username and
 * password rather than a ready-made link, so this saves the user from having to
 * know the `get.php` convention.
 *
 * Pure and side-effect free: it returns a string for the form field and never
 * performs a request. The import endpoint is what fetches the playlist and
 * seals the credentials server-side.
 *
 * Returns null when the inputs cannot form a valid http(s) URL.
 */
export type XtreamParts = { server: string; username: string; password: string };

export function buildXtreamPlaylistUrl({ server, username, password }: XtreamParts): string | null {
  const raw = server.trim();
  const user = username.trim();
  const pass = password.trim();
  if (!raw || !user || !pass) return null;
  try {
    // Providers routinely omit the scheme; assume http, which is what their
    // panels print. The server-side import guard re-validates the host.
    const url = new URL(raw.includes('://') ? raw : `http://${raw}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null;
    // Discard any path, query or embedded credentials the user pasted.
    url.pathname = '/get.php';
    url.search = '';
    url.hash = '';
    url.username = '';
    url.password = '';
    url.searchParams.set('username', user);
    url.searchParams.set('password', pass);
    url.searchParams.set('type', 'm3u_plus');
    url.searchParams.set('output', 'ts');
    return url.toString();
  } catch {
    return null;
  }
}
