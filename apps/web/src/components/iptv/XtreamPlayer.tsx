'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { XtreamClient, XtreamCredentials, XtreamCategory, XtreamStream, XtreamMovie, XtreamSeries, XtreamEpisode, XtreamError, XtreamErrorCode, createClientFromStorage, saveCredentials, clearCredentials, hasStoredCredentials } from '../../lib/xtream-client';
import type { Language } from './PublicTv';
import { VideoPlayerModal } from '../player/VideoPlayerModal';
import { getStreamType } from '../../lib/player-utils';
import type { Channel } from '../../types/channel';
import { matchesSearch } from '../../lib/search-normalize';

type Kind = 'live' | 'movie' | 'series';

type Group = { id: string; name: string; parentId?: number };
type Item = {
  id: string;
  name: string;
  icon?: string;
  ext?: string;
  season?: string;
  episode?: string;
  rating?: string;
  plot?: string;
};
type AccountStatus = { status: string; expiresAt: number | null; activeConnections: number | null; maxConnections: number | null };
type Playing = { url: string; name: string; hls: boolean; kind: Kind; container: string };
type Gate = 'loading' | 'ready' | 'credentials' | 'denied' | 'unconfigured' | 'error';

const T: Record<Language, Record<string, string>> = {
  ar: {
    title: 'سيرفر IPTV الخاص بك',
    subtitle: 'أدخل بيانات الدخول للوصول للكتالوج (قنوات، أفلام، مسلسلات). البيانات تبقى في متصفحك فقط.',
    live: 'قنوات مباشرة', movie: 'أفلام', series: 'مسلسلات',
    groups: 'التصنيفات', search: 'ابحث بالاسم…', back: 'رجوع للتصنيفات',
    episodes: 'الحلقات', season: 'الموسم', episode: 'حلقة',
    play: 'تشغيل', close: 'إغلاق', loading: 'جاري التحميل…', retry: 'إعادة المحاولة',
    emptyGroups: 'لم يُرجع السيرفر تصنيفات.', emptyItems: 'لا توجد عناصر في هذا التصنيف.',
    noResults: 'لا نتائج مطابقة للبحث.', pickGroup: 'اختر تصنيفاً لعرض محتواه.',
    credentialsTitle: 'إدخال بيانات السيرفر',
    credentialsDesc: 'بيانات الدخول تُحفظ في متصفحك فقط ولا تُرسل لأي خادم خارجي.',
    serverLabel: 'عنوان السيرفر (مثال: http://redchicks.xyz:2052)',
    usernameLabel: 'اسم المستخدم',
    passwordLabel: 'كلمة المرور',
    proxyLabel: 'عنوان البروكسي (اختياري - Cloudflare Worker)',
    proxyPlaceholder: 'https://your-worker.workers.dev',
    proxyHelp: 'يُستخدم لتجاوز حجب IP السيرفر. اتركه فارغاً للاتصال المباشر.',
    saveBtn: 'حفظ والاتصال',
    savedCredentials: 'محفوظة', changeCredentials: 'تغيير البيانات',
    deniedTitle: 'خطأ في الاتصال',
    deniedBody: 'تحقق من بيانات الدخول أو أن السيرفر يعمل.',
    unconfiguredTitle: 'غير مهيأ',
    unconfiguredBody: 'أدخل بيانات السيرفر أولاً.',
    connectionError: 'تعذر الاتصال بالسيرفر. تحقق من العنوان والبيانات.',
    invalidCredentials: 'اسم مستخدم أو كلمة مرور غير صحيحة.',
    serverBlocked: 'السيرفر حظر الطلب. جرب من شبكة أخرى أو استخدم VPN.',
    rateLimited: 'طلبات كثيرة، انتظر دقيقة ثم حاول مرة أخرى.',
    invalidResponse: 'رد غير متوقع من السيرفر.',
    serverUnreachable: 'لا يمكن الوصول للسيرفر. تحقق من الاتصال.',
    expires: 'ينتهي الاشتراك', connections: 'الاتصالات', status: 'الحالة',
    privateNote: 'بيانات الدخول تبقى في متصفحك فقط، والتشغيل مباشر من السيرفر لمشغّل المتصفح.',
    playerError: 'تعذّر تشغيل هذا المصدر. قد يكون غير متاح أو بصيغة لا يدعمها المتصفح.',
    formatNote: 'صيغة الملف قد لا يدعمها المتصفح؛ جرّب عنصراً آخر بصيغة MP4.',
    testConnection: 'اختبار الاتصال',
    connecting: 'جاري الاتصال…',
    clearData: 'مسح البيانات المحفوظة',
  },
  en: {
    title: 'Your IPTV Server',
    subtitle: 'Enter credentials to access the catalog (Live TV, Movies, Series). Data stays in your browser only.',
    live: 'Live TV', movie: 'Movies', series: 'Series',
    groups: 'Categories', search: 'Search by name…', back: 'Back to categories',
    episodes: 'Episodes', season: 'Season', episode: 'Episode',
    play: 'Play', close: 'Close', loading: 'Loading…', retry: 'Try again',
    emptyGroups: 'The server returned no categories.', emptyItems: 'Nothing in this category.',
    noResults: 'No matches for your search.', pickGroup: 'Pick a category to browse its content.',
    credentialsTitle: 'Enter Server Credentials',
    credentialsDesc: 'Credentials are stored only in your browser and never sent to any external server.',
    serverLabel: 'Server URL (e.g. http://redchicks.xyz:2052)',
    usernameLabel: 'Username',
    passwordLabel: 'Password',
    proxyLabel: 'Proxy URL (optional - Cloudflare Worker)',
    proxyPlaceholder: 'https://your-worker.workers.dev',
    proxyHelp: 'Used to bypass server IP blocks. Leave empty for direct connection.',
    saveBtn: 'Save & Connect',
    savedCredentials: 'Saved', changeCredentials: 'Change credentials',
    deniedTitle: 'Connection Error',
    deniedBody: 'Check your credentials or that the server is working.',
    unconfiguredTitle: 'Not Configured',
    unconfiguredBody: 'Enter server credentials first.',
    connectionError: 'Could not connect to server. Check the URL and credentials.',
    invalidCredentials: 'Invalid username or password.',
    serverBlocked: 'Server blocked the request. Try from another network or use VPN.',
    rateLimited: 'Too many requests, wait a minute and try again.',
    invalidResponse: 'Unexpected response from server.',
    serverUnreachable: 'Cannot reach server. Check your connection.',
    expires: 'Subscription ends', connections: 'Connections', status: 'Status',
    privateNote: 'Credentials stay in your browser; playback is direct from server to browser player.',
    playerError: 'This source could not be played. It may be offline or in a format the browser cannot decode.',
    formatNote: 'This container may not be browser-playable; try an MP4 title instead.',
    testConnection: 'Test Connection',
    connecting: 'Connecting…',
    clearData: 'Clear saved data',
  },
};

function toPlayerChannel(source: Playing, name: string): Channel {
  return {
    id: source.url,
    name,
    logo: '',
    streamUrl: source.url,
    streamType: source.hls ? 'hls' : source.container === 'mp4' ? 'mp4' : 'hls',
    category: source.kind,
    sourceGroup: source.kind,
    country: '',
    countryCode: '',
    language: '',
    isLive: source.kind === 'live',
    playable: true,
    epgId: '',
  };
}

function mapErrorToCode(error: XtreamError): string {
  switch (error.code) {
    case 'INVALID_CREDENTIALS': return 'INVALID_CREDENTIALS';
    case 'SERVER_BLOCKED': return 'SERVER_BLOCKED';
    case 'RATE_LIMITED': return 'RATE_LIMITED';
    case 'INVALID_RESPONSE': return 'INVALID_RESPONSE';
    case 'SERVER_UNREACHABLE': return 'SERVER_UNREACHABLE';
    default: return 'UNKNOWN_ERROR';
  }
}

export default function XtreamPlayer({ language }: { language: Language }) {
  const t = T[language];
  const [gate, setGate] = useState<Gate>('loading');
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [kind, setKind] = useState<Kind>('live');
  const [groups, setGroups] = useState<Group[]>([]);
  const [category, setCategory] = useState<Group | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [series, setSeries] = useState<Item | null>(null);
  const [episodes, setEpisodes] = useState<Item[]>([]);
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [playerError, setPlayerError] = useState('');
  const [filter, setFilter] = useState('');
  const [credentials, setCredentials] = useState<XtreamCredentials>({
    server: 'http://redchicks.xyz:2052',
    username: 'adam@net',
    password: '83632625225643',
    proxyUrl: '',
  });
  const [showSavedNotice, setShowSavedNotice] = useState(false);
  const clientRef = useRef<XtreamClient | null>(null);
  const requestId = useRef(0);

  const message = useCallback((code: string) => t[code] || t.connectionError, [language, t]);

  // Initialize: check for stored credentials
  useEffect(() => {
    const stored = createClientFromStorage();
    if (stored) {
      clientRef.current = stored;
      const creds = stored.getCredentials();
      setCredentials(creds);
      setGate('ready');
      setShowSavedNotice(true);
      // Auto-load categories
      loadGroups();
    } else {
      setGate('credentials');
    }
  }, []);

  const loadGroups = useCallback(async () => {
    const client = clientRef.current;
    if (!client || gate !== 'ready') return;

    const current = ++requestId.current;
    setBusy(true);
    setError('');

    try {
      let result: Group[];
      if (kind === 'live') {
        result = (await client.getLiveCategories()).map(c => ({
          id: c.category_id,
          name: c.category_name,
          parentId: c.parent_id,
        }));
      } else if (kind === 'movie') {
        result = (await client.getVodCategories()).map(c => ({
          id: c.category_id,
          name: c.category_name,
          parentId: c.parent_id,
        }));
      } else {
        result = (await client.getSeriesCategories()).map(c => ({
          id: c.category_id,
          name: c.category_name,
          parentId: c.parent_id,
        }));
      }

      if (!clientRef.current || current !== requestId.current) return;
      setGroups(result);
      setCategory(null);
      setItems([]);
      setSeries(null);
      setEpisodes([]);
      setFilter('');
    } catch (cause) {
      if (!clientRef.current || current !== requestId.current) return;
      if (cause instanceof XtreamError) {
        setError(mapErrorToCode(cause));
      } else {
        setError('UNKNOWN_ERROR');
      }
    } finally {
      if (clientRef.current && current === requestId.current) setBusy(false);
    }
  }, [kind, gate]);

  const handleSaveCredentials = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const client = new XtreamClient(credentials);
      // Test connection
      const accountInfo = await client.testConnection();

      clientRef.current = client;
      saveCredentials(credentials);

      const userInfo = accountInfo.user_info;
      const expDate = userInfo.exp_date ? parseInt(userInfo.exp_date) * 1000 : null;
      setAccount({
        status: userInfo.status || 'active',
        expiresAt: expDate && expDate > 0 ? expDate : null,
        activeConnections: parseInt(userInfo.active_cons) || null,
        maxConnections: parseInt(userInfo.max_connections) || null,
      });

      setGate('ready');
      setShowSavedNotice(true);
      loadGroups();
    } catch (cause) {
      if (cause instanceof XtreamError) {
        setError(mapErrorToCode(cause));
        setGate('error');
      } else {
        setError('UNKNOWN_ERROR');
        setGate('error');
      }
    } finally {
      setBusy(false);
    }
  }, [credentials, loadGroups]);

  const handleChangeCredentials = useCallback(() => {
    clearCredentials();
    clientRef.current = null;
    setGate('credentials');
    setCredentials({
      server: 'http://redchicks.xyz:2052',
      username: 'adam@net',
      password: '83632625225643',
      proxyUrl: '',
    });
    setAccount(null);
    setGroups([]);
    setCategory(null);
    setItems([]);
    setSeries(null);
    setEpisodes([]);
    setShowSavedNotice(false);
  }, []);

  const openCategory = useCallback(async (group: Group) => {
    const client = clientRef.current;
    if (!client || gate !== 'ready') return;

    const current = ++requestId.current;
    setBusy(true);
    setError('');
    setCategory(group);
    setItems([]);
    setSeries(null);
    setEpisodes([]);
    setFilter('');

    try {
      let result: Item[];
      if (kind === 'live') {
        const streams = await client.getLiveStreams(group.id);
        result = streams.map(s => ({
          id: s.stream_id,
          name: s.name,
          icon: s.stream_icon,
          ext: s.stream_type === 'live' ? 'm3u8' : 'ts',
        }));
      } else if (kind === 'movie') {
        const movies = await client.getVodStreams(group.id);
        result = movies.map(m => ({
          id: m.stream_id,
          name: m.name,
          icon: m.stream_icon,
          ext: m.container_extension,
          rating: m.rating,
        }));
      } else {
        const seriesList = await client.getSeries(group.id);
        result = seriesList.map(s => ({
          id: s.series_id,
          name: s.name,
          icon: s.cover,
          plot: s.plot,
          rating: s.rating,
        }));
      }

      if (!clientRef.current || current !== requestId.current) return;
      setItems(result);
    } catch (cause) {
      if (!clientRef.current || current !== requestId.current) return;
      if (cause instanceof XtreamError) {
        setError(mapErrorToCode(cause));
      } else {
        setError('UNKNOWN_ERROR');
      }
    } finally {
      if (clientRef.current && current === requestId.current) setBusy(false);
    }
  }, [kind, gate]);

  const openSeries = useCallback(async (item: Item) => {
    const client = clientRef.current;
    if (!client || gate !== 'ready') return;

    const current = ++requestId.current;
    setBusy(true);
    setError('');
    setSeries(item);
    setEpisodes([]);

    try {
      const info = await client.getSeriesInfo(item.id);
      const allEpisodes: Item[] = [];

      for (const [season, eps] of Object.entries(info.episodes)) {
        for (const ep of eps) {
          allEpisodes.push({
            id: ep.id,
            name: ep.title || ep.info?.title || `Episode ${ep.episode_num}`,
            icon: ep.info?.movie_image,
            ext: ep.container_extension,
            season: String(season),
            episode: String(ep.episode_num),
            plot: ep.info?.plot,
          });
        }
      }

      if (!clientRef.current || current !== requestId.current) return;
      setEpisodes(allEpisodes.slice(0, 500));
    } catch (cause) {
      if (!clientRef.current || current !== requestId.current) return;
      if (cause instanceof XtreamError) {
        setError(mapErrorToCode(cause));
      } else {
        setError('UNKNOWN_ERROR');
      }
    } finally {
      if (clientRef.current && current === requestId.current) setBusy(false);
    }
  }, [gate]);

  const play = useCallback(async (item: Item, playKind: Kind) => {
    const client = clientRef.current;
    if (!client) return;

    setPlayerError('');
    setError('');

    try {
      let url: string;
      let container: string;
      let hls: boolean;

      if (playKind === 'live') {
        url = client.getLiveStreamUrl(item.id, item.ext || 'm3u8');
        container = item.ext || 'm3u8';
        hls = true;
      } else if (playKind === 'movie') {
        url = client.getVodStreamUrl(item.id, item.ext || 'mp4');
        container = item.ext || 'mp4';
        hls = container === 'm3u8';
      } else {
        url = client.getSeriesStreamUrl(item.id, item.ext || 'mp4');
        container = item.ext || 'mp4';
        hls = container === 'm3u8';
      }

      setPlaying({ url, name: item.name, hls, kind: playKind, container });
    } catch (cause) {
      if (cause instanceof XtreamError) {
        setError(mapErrorToCode(cause));
      } else {
        setError('UNKNOWN_ERROR');
      }
    }
  }, []);

  const onPlayerError = useCallback(() => setPlayerError('PLAYER'), []);

  const visible = useMemo(
    () => items.filter(item => matchesSearch(item.name, filter)),
    [items, filter],
  );

  // Gate rendering
  if (gate === 'loading') {
    return <div className="pp-gate" role="status"><p>{t.loading}</p></div>;
  }

  if (gate === 'credentials') {
    return (
      <div className="pp-gate pp-credentials">
        <h2>{t.credentialsTitle}</h2>
        <p>{t.credentialsDesc}</p>
        <form onSubmit={handleSaveCredentials} className="pp-cred-form">
          <div>
            <label htmlFor="server">{t.serverLabel}</label>
            <input
              id="server"
              type="text"
              value={credentials.server}
              onChange={e => setCredentials(c => ({ ...c, server: e.target.value }))}
              placeholder="http://redchicks.xyz:2052"
              required
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="username">{t.usernameLabel}</label>
            <input
              id="username"
              type="text"
              value={credentials.username}
              onChange={e => setCredentials(c => ({ ...c, username: e.target.value }))}
              required
              autoComplete="username"
            />
          </div>
          <div>
            <label htmlFor="password">{t.passwordLabel}</label>
            <input
              id="password"
              type="password"
              value={credentials.password}
              onChange={e => setCredentials(c => ({ ...c, password: e.target.value }))}
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <label htmlFor="proxy">{t.proxyLabel}</label>
            <input
              id="proxy"
              type="url"
              value={credentials.proxyUrl || ''}
              onChange={e => setCredentials(c => ({ ...c, proxyUrl: e.target.value }))}
              placeholder={t.proxyPlaceholder}
              autoComplete="off"
            />
            <small className="pp-help">{t.proxyHelp}</small>
          </div>
          <button type="submit" className="pp-primary" disabled={busy}>
            {busy ? t.connecting : t.saveBtn}
          </button>
          {error && <p className="pp-error" role="alert">{message(error)}</p>}
        </form>
      </div>
    );
  }

  if (gate === 'error' || gate === 'denied' || gate === 'unconfigured') {
    const heading = gate === 'error' ? t.deniedTitle : t.unconfiguredTitle;
    const body = gate === 'error' ? t.deniedBody : t.unconfiguredBody;
    return (
      <div className="pp-gate">
        <h2>{heading}</h2>
        <p>{body}</p>
        {error && <p className="pp-error">{message(error)}</p>}
        <button className="pp-primary" onClick={handleChangeCredentials}>
          {t.changeCredentials}
        </button>
      </div>
    );
  }

  const list = series ? episodes : visible;

  return (
    <div className="pp">
      <div className="pp-head">
        <div>
          <h2>{t.title}</h2>
          <p>{t.subtitle}</p>
        </div>
        {showSavedNotice && (
          <span className="pp-saved-badge">{t.savedCredentials}</span>
        )}
        {account && (
          <dl className="pp-account">
            <div><dt>{t.status}</dt><dd>{account.status}</dd></div>
            {account.expiresAt && <div><dt>{t.expires}</dt><dd>{new Date(account.expiresAt).toLocaleDateString(language === 'ar' ? 'ar-IQ' : 'en-GB')}</dd></div>}
            {account.maxConnections !== null && <div><dt>{t.connections}</dt><dd>{account.activeConnections ?? 0} / {account.maxConnections}</dd></div>}
          </dl>
        )}
        <button className="pp-ghost pp-change-creds" onClick={handleChangeCredentials}>
          {t.changeCredentials}
        </button>
      </div>

      <div className="pp-tabs" role="tablist">
        {(['live', 'movie', 'series'] as Kind[]).map(value => (
          <button
            key={value}
            role="tab"
            aria-selected={kind === value}
            className={kind === value ? 'pp-tab selected' : 'pp-tab'}
            onClick={() => { setKind(value); loadGroups(); }}
            disabled={busy}
          >
            {t[value]}
          </button>
        ))}
      </div>

      <div aria-live="polite">
        {error && <p className="pp-error">{message(error)}</p>}
        {busy && <p className="pp-note">{t.loading}</p>}
      </div>

      {!category && !busy && groups.length === 0 && !error && <p className="pp-note">{t.emptyGroups}</p>}

      {!category && groups.length > 0 && (
        <>
          <p className="pp-label">{t.groups} · {groups.length}</p>
          <div className="pp-groups">
            {groups.map(group => (
              <button key={group.id} className="pp-group" onClick={() => void openCategory(group)} disabled={busy}>
                {group.name}
              </button>
            ))}
          </div>
        </>
      )}

      {category && (
        <>
          <div className="pp-toolbar">
            <button className="pp-ghost" onClick={() => {
              if (series) { setSeries(null); setEpisodes([]); return; }
              setCategory(null); setItems([]); setFilter('');
            }} disabled={busy}>
              ← {series ? category.name : t.back}
            </button>
            <strong>{series ? series.name : category.name}</strong>
            {!series && (
              <input className="pp-search" value={filter} onChange={event => setFilter(event.target.value)} placeholder={t.search} aria-label={t.search} disabled={busy} />
            )}
          </div>

          {!busy && list.length === 0 && !error && <p className="pp-note">{filter ? t.noResults : series ? t.episodes : t.emptyItems}</p>}

          <div className={series || kind === 'live' ? 'pp-rows' : 'pp-grid'}>
            {list.map(item => (
              <button
                key={`${item.id}-${item.episode ?? ''}`}
                className={series || kind === 'live' ? 'pp-row' : 'pp-card'}
                onClick={() => {
                  if (kind === 'series' && !series) void openSeries(item);
                  else void play(item, kind === 'series' ? 'series' : kind);
                }}
                disabled={busy}
              >
                {item.icon
                  ? <img className="pp-art" src={item.icon} alt="" loading="lazy" />
                  : <span className="pp-art pp-art-fallback" aria-hidden="true">{item.name.slice(0, 1)}</span>}
                <span className="pp-name">
                  {series && item.season ? `${t.season} ${item.season} · ${t.episode} ${item.episode} — ${item.name}` : item.name}
                  {item.rating && <small> ⭐ {item.rating}</small>}
                </span>
                <span className="pp-play">{kind === 'series' && !series ? t.episodes : t.play}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <p className="pp-note pp-footnote">{t.privateNote}</p>

      {playing && (
        <div className="pp-modal" role="dialog" aria-modal="true" aria-label={playing.name}>
          <div className="pp-modal-inner">
            <div className="pp-modal-head">
              <strong>{playing.name}</strong>
              <button className="pp-ghost" onClick={() => { setPlaying(null); setPlayerError(''); }}>{t.close} ✕</button>
            </div>
            <VideoPlayerModal
              key={playing.url}
              channel={toPlayerChannel(playing, playing.name)}
              language={language}
              onClose={() => { setPlaying(null); setPlayerError(''); }}
            />
            {playerError && <p className="pp-error">{t.playerError}</p>}
            {!playing.hls && playing.container !== 'mp4' && <p className="pp-note">{t.formatNote}</p>}
          </div>
        </div>
      )}
    </div>
  );
}