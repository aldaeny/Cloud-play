/** Apply the requested return to dark once per device; later user choices persist. */
export function readAppearance(): 'dark' | 'light' {
  try {
    const resetKey = 'cloudplay-dark-return-v1';
    if (localStorage.getItem(resetKey) !== 'done') {
      localStorage.setItem('cloudplay-theme', 'dark');
      localStorage.setItem(resetKey, 'done');
      return 'dark';
    }
    return localStorage.getItem('cloudplay-theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}
