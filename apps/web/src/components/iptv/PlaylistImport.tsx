import { useCallback, useMemo, useRef, useState } from 'react';
import { ownerRequest } from '../../lib/owner-api';
import MediaViewer from '../player/MediaViewer';

type Language = 'ar' | 'en';

type Channel = {
  id: string;
  name: string;
  group: string;
  logo?: string;
  url: string;
  kind: 'hls' | 'mp4';
  container: string;
  risky: boolean;
};

type Result = {
  channels: Channel[];
  groups: { name: string; count: number }[];
  total: number;
  returned: number;
  truncated: boolean;
  skipped: number;
  host: string;
  fetchedAt: number;
};

type Saved = { id: string; label: string; url: string };

const STORE_KEY = 'cloudplay-owner-playlists-v1';
const PAGE = 60;

const T = {
  ar: {
    title: 'قوائمي الخاصة',
    subtitle: 'الصق رابط قائمة M3U لعرض قنواتها هنا. هذه القائمة لك وحدك — لا تظهر لأي زائر ولا تُفهرس.',
    urlLabel: 'رابط القائمة (M3U / M3U8)',
    urlPlaceholder: 'https://example.com/playlist.m3u',
    labelLabel: 'اسم مختصر (اختياري)',
    labelPlaceholder: 'قائمتي',
    remember: 'احفظ الرابط في هذا المتصفح',
    rememberWarn: 'روابط القوائم تحتوي غالباً اسم المستخدم وكلمة المرور. الحفظ يخزّنها في متصفحك نصاً صريحاً — فعّله فقط على جهازك الشخصي.',
    import: 'استورد القائمة',
    loading: 'جارٍ جلب القائمة…',
    saved: 'القوائم المحفوظة',
    forget: 'انسَ الكل',
    remove: 'احذف',
    open: 'افتح',
    search: 'ابحث عن قناة…',
    allGroups: 'كل المجموعات',
    channels: 'قناة',
    play: 'شغّل',
    close: 'إغلاق',
    noResults: 'لا قناة مطابقة.',
    more: 'اعرض المزيد',
    truncated: (n: number, total: number) => `القائمة أكبر من الحد المسموح. عُرضت ${n} من ${total} قناة.`,
    skipped: (n: number) => `تم تجاهل ${n} مدخلاً (مكرر، أو مضيف خاص/محجوب، أو رابط غير صالح).`,
    host: 'المضيف',
    risky: 'صيغة قد لا يدعمها المتصفح',
    privateNote: 'هذه الطبقة خاصة لا تطبّق مرشّحات المحتوى العامة، لأن القائمة من اختيارك. الخادم يخفي الروابط الأصلية وبيانات الدخول برموز مشفّرة مؤقتة.',
    playerError: 'تعذّر تشغيل هذه القناة. قد يكون المصدر متوقفاً أو محجوباً.',
  },
  en: {
    title: 'My private playlists',
    subtitle: 'Paste an M3U playlist URL to list its channels here. This list is yours alone — invisible to visitors and not indexed.',
    urlLabel: 'Playlist URL (M3U / M3U8)',
    urlPlaceholder: 'https://example.com/playlist.m3u',
    labelLabel: 'Short name (optional)',
    labelPlaceholder: 'My list',
    remember: 'Remember this URL in this browser',
    rememberWarn: 'Playlist URLs often embed a username and password. Remembering stores them in your browser in plain text — enable only on your own device.',
    import: 'Import playlist',
    loading: 'Fetching playlist…',
    saved: 'Saved playlists',
    forget: 'Forget all',
    remove: 'Remove',
    open: 'Open',
    search: 'Search channels…',
    allGroups: 'All groups',
    channels: 'channels',
    play: 'Play',
    close: 'Close',
    noResults: 'No matching channel.',
    more: 'Load more',
    truncated: (n: number, total: number) => `This list exceeds the cap. Showing ${n} of ${total} channels.`,
    skipped: (n: number) => `Skipped ${n} entries (duplicates, private/blocked hosts, or invalid URLs).`,
    host: 'Host',
    risky: 'Format a browser may not decode',
    privateNote: 'This private tier does not apply the public content filters, because the list is your own choice. The server hides origin URLs and credentials behind temporary encrypted tokens.',
    playerError: 'This channel could not play. The source may be down or blocked.',
  },
} as const;

const ERRORS: Record<Language, Record<string, string>> = {
  ar: {
    INVALID_URL: 'الرابط غير صالح أو يشير إلى مضيف خاص/محجوب.',
    NOT_A_PLAYLIST: 'الرابط لا يُرجع قائمة M3U (قد يكون صفحة دخول أو خطأ).',
    EMPTY_PLAYLIST: 'لم تُعثر على قناة صالحة في القائمة.',
    TOO_LARGE: 'القائمة أكبر من الحد المسموح (16 ميغابايت).',
    RATE_LIMIT: 'طلبات استيراد كثيرة. انتظر قليلاً ثم أعد المحاولة.',
    NOT_CONFIGURED: 'الخدمة غير مهيّأة على الخادم.',
    SIGN_IN_REQUIRED: 'سجّل الدخول أولاً.',
    NOT_AUTHORIZED: 'هذا الحساب لا يملك المشغّل الخاص.',
    ACCOUNTS_OFF: 'الحسابات غير مفعّلة.',
    UPSTREAM_ERROR: 'تعذّر جلب القائمة من المصدر.',
  },
  en: {
    INVALID_URL: 'The URL is invalid or points at a private/blocked host.',
    NOT_A_PLAYLIST: 'That URL did not return an M3U playlist (may be a login or error page).',
    EMPTY_PLAYLIST: 'No usable channel was found in the list.',
    TOO_LARGE: 'The playlist exceeds the 16 MB cap.',
    RATE_LIMIT: 'Too many imports. Wait a little and retry.',
    NOT_CONFIGURED: 'The service is not configured on the server.',
    SIGN_IN_REQUIRED: 'Sign in first.',
    NOT_AUTHORIZED: 'This account does not own the private player.',
    ACCOUNTS_OFF: 'Accounts are not enabled.',
    UPSTREAM_ERROR: 'The playlist could not be fetched from the source.',
  },
};

function readSaved(): Saved[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Saved =>
        !!item && typeof item === 'object'
        && typeof (item as Saved).id === 'string'
        && typeof (item as Saved).url === 'string'
        && typeof (item as Saved).label === 'string')
      .slice(0, 20);
  } catch {
    return [];
  }
}

function writeSaved(list: Saved[]): void {
  try {
    if (list.length === 0) window.localStorage.removeItem(STORE_KEY);
    else window.localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {
    // Private-mode or quota failure: remembering is a convenience, not a requirement.
  }
}

/**
 * Owner-only M3U import panel, rendered inside the gated private player.
 *
 * The server does the fetching, parsing and credential hiding; this component
 * only ever holds same-origin token URLs. Saving a playlist URL is opt-in and
 * warned about, because such URLs routinely embed credentials.
 */
export default function PlaylistImport({ language }: { language: Language }) {
  const t = T[language];
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [remember, setRemember] = useState(false);
  // This panel only mounts client-side, after the owner gate resolves, so a lazy
  // initialiser can read localStorage directly — no effect, no hydration mismatch.
  const [saved, setSaved] = useState<Saved[]>(() => readSaved());
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [group, setGroup] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [playing, setPlaying] = useState<Channel | null>(null);
  const [playerError, setPlayerError] = useState(false);
  const requestId = useRef(0);

  const message = useCallback(
    (code: string) => ERRORS[language][code] || ERRORS[language].UPSTREAM_ERROR,
    [language],
  );

  const load = useCallback(async (target: string, save: boolean, name: string) => {
    const trimmed = target.trim();
    if (!trimmed) return;
    const current = ++requestId.current;
    setBusy(true);
    setError('');
    setResult(null);
    setFilter('');
    setGroup('');
    setShown(PAGE);
    try {
      const { data } = await ownerRequest<{ data: Result }>('/api/playlist/import', {
        method: 'POST',
        body: JSON.stringify({ url: trimmed }),
      });
      if (current !== requestId.current) return;
      setResult(data);
      if (save) {
        const entry: Saved = {
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          label: (name.trim() || data.host).slice(0, 80),
          url: trimmed,
        };
        setSaved(previous => {
          const next = [entry, ...previous.filter(item => item.url !== trimmed)].slice(0, 20);
          writeSaved(next);
          return next;
        });
      }
    } catch (cause) {
      if (current !== requestId.current) return;
      setError(cause instanceof Error ? cause.message : 'UPSTREAM_ERROR');
    } finally {
      if (current === requestId.current) setBusy(false);
    }
  }, []);

  const visible = useMemo(() => {
    if (!result) return [];
    const needle = filter.trim().toLowerCase();
    return result.channels.filter(channel =>
      (!group || channel.group === group)
      && (!needle || channel.name.toLowerCase().includes(needle)));
  }, [result, filter, group]);

  const removeSaved = (id: string) => {
    setSaved(previous => {
      const next = previous.filter(item => item.id !== id);
      writeSaved(next);
      return next;
    });
  };

  return (
    <section className="pli" aria-label={t.title}>
      <div className="pli-head">
        <h3>{t.title}</h3>
        <p>{t.subtitle}</p>
      </div>

      <form
        className="pli-form"
        onSubmit={event => { event.preventDefault(); void load(url, remember, label); }}
      >
        <label className="pli-field">
          <span>{t.urlLabel}</span>
          <input
            type="url"
            value={url}
            onChange={event => setUrl(event.target.value)}
            placeholder={t.urlPlaceholder}
            autoComplete="off"
            spellCheck={false}
            required
          />
        </label>
        <label className="pli-field pli-field-short">
          <span>{t.labelLabel}</span>
          <input
            type="text"
            value={label}
            onChange={event => setLabel(event.target.value)}
            placeholder={t.labelPlaceholder}
            maxLength={80}
          />
        </label>
        <label className="pli-check">
          <input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />
          <span>{t.remember}</span>
        </label>
        {remember && <p className="pli-warn">{t.rememberWarn}</p>}
        <button className="pp-primary" type="submit" disabled={busy || !url.trim()}>
          {busy ? t.loading : t.import}
        </button>
      </form>

      {saved.length > 0 && (
        <div className="pli-saved">
          <div className="pli-saved-head">
            <span className="pp-label">{t.saved} · {saved.length}</span>
            <button className="pp-ghost" type="button" onClick={() => { setSaved([]); writeSaved([]); }}>
              {t.forget}
            </button>
          </div>
          <ul>
            {saved.map(item => (
              <li key={item.id}>
                <span className="pli-saved-name">{item.label}</span>
                <button className="pp-ghost" type="button" onClick={() => { setUrl(item.url); void load(item.url, false, item.label); }}>
                  {t.open}
                </button>
                <button className="pp-ghost" type="button" onClick={() => removeSaved(item.id)}>{t.remove}</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="pp-error">{message(error)}</p>}
      {busy && <p className="pp-note" role="status">{t.loading}</p>}

      {result && (
        <div className="pli-result">
          <p className="pp-note">
            {t.host}: <strong>{result.host}</strong> · {result.returned} {t.channels}
          </p>
          {result.truncated && <p className="pli-warn">{t.truncated(result.returned, result.total)}</p>}
          {result.skipped > 0 && <p className="pp-note">{t.skipped(result.skipped)}</p>}

          <div className="pp-toolbar">
            <input
              className="pp-search"
              value={filter}
              onChange={event => { setFilter(event.target.value); setShown(PAGE); }}
              placeholder={t.search}
              aria-label={t.search}
            />
            <select
              className="pli-select"
              value={group}
              onChange={event => { setGroup(event.target.value); setShown(PAGE); }}
              aria-label={t.allGroups}
            >
              <option value="">{t.allGroups} ({result.channels.length})</option>
              {result.groups.map(item => (
                <option key={item.name} value={item.name}>{item.name} ({item.count})</option>
              ))}
            </select>
          </div>

          {visible.length === 0
            ? <p className="pp-note">{t.noResults}</p>
            : (
              <ul className="pli-grid">
                {visible.slice(0, shown).map(channel => (
                  <li key={channel.id}>
                    <button
                      type="button"
                      className="pli-card"
                      onClick={() => { setPlaying(channel); setPlayerError(false); }}
                    >
                      {channel.logo
                        ? <img className="pp-art" src={channel.logo} alt="" loading="lazy" />
                        : <span className="pp-art pp-art-fallback" aria-hidden="true">{channel.name.slice(0, 1)}</span>}
                      <span className="pp-name">
                        <span>{channel.name}</span>
                        <small>{channel.group}{channel.risky ? ` · ${t.risky}` : ''}</small>
                      </span>
                      <span className="pp-play">{t.play}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

          {visible.length > shown && (
            <button className="pp-ghost" type="button" onClick={() => setShown(count => count + PAGE)}>
              {t.more} ({visible.length - shown})
            </button>
          )}
        </div>
      )}

      <p className="pp-note pp-footnote">{t.privateNote}</p>

      {playing && (
        <MediaViewer
          language={language}
          title={playing.name}
          url={playing.url}
          kind={playing.kind}
          onClose={() => { setPlaying(null); setPlayerError(false); }}
          footer={playerError ? <p className="pp-error">{t.playerError}</p> : undefined}
        />
      )}
    </section>
  );
}
