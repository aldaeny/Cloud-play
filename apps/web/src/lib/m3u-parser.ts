// M3U Parser Utility
export interface M3UEntry {
  title: string;
  url: string;
  attributes: Record<string, string>;
}

export function parseM3U(content: string): M3UEntry[] {
  const lines = content.split('\n');
  const entries: M3UEntry[] = [];
  let currentEntry: M3UEntry | null = null;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#EXTM3U')) return;

    if (trimmed.startsWith('#EXTINF:')) {
      const parts = trimmed.split(':', 1);
      const info = parts[1];
      const commaIndex = info.indexOf(',');
      
      const duration = info.substring(0, commaIndex);
      const title = info.substring(commaIndex + 1);
      
      const attrs: Record<string, string> = {};
      const attrRegex = /([a-zA-Z0-9_-]+)="([^"]+)"/g;
      let match;
      while ((match = attrRegex.exec(info)) !== null) {
        attrs[match[1]] = match[2];
      }

      currentEntry = {
        title,
        url: '',
        attributes: { ...attrs, duration }
      };
    } else if (currentEntry && !trimmed.startsWith('#')) {
      currentEntry.url = trimmed;
      entries.push(currentEntry);
      currentEntry = null;
    }
  });

  return entries;
}
