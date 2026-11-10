import { Injectable } from '@nestjs/common';
import { pinnedProviderRequest } from '../../common/pinned-provider-request';
import { normalizeCatalog, CATALOG_KINDS } from './xtream-catalog-sync.service';

const ACTIONS = ['get_live_streams', 'get_vod_streams', 'get_series',
  'get_live_categories', 'get_vod_categories', 'get_series_categories'];

/** Server-only authorized Xtream metadata adapter. Plain credentials exist only
 * inside this call, never in URLs, normalized rows, diagnostics or thrown errors. */
@Injectable()
export class XtreamProviderAdapter {
  async retrieve(baseUrl: string, username: string, password: string, signal: AbortSignal) {
    const base = new URL(baseUrl);
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw new Error('PROVIDER_URL_INVALID');
    const endpoint = new URL('player_api.php', base.href.endsWith('/') ? base : new URL(base.href + '/'));
    const lists = await Promise.all(ACTIONS.map(async (action, index) => {
      const response = await pinnedProviderRequest(endpoint, {
        method: 'POST', body: new URLSearchParams({ username, password, action }).toString(),
        signal, redirect: 'error',
      }, undefined, 2 * 1024 * 1024);
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'PROVIDER_AUTH_REJECTED' : 'PROVIDER_FETCH_FAILED');
      const input: unknown = await response.json();
      if (!Array.isArray(input) || input.length > 10000) throw new Error('PROVIDER_RESPONSE_INVALID');
      return input.map(value => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('PROVIDER_RESPONSE_INVALID');
        const row = value as Record<string, unknown>;
        const name = index < 3 ? row.name : row.category_name;
        if (typeof name !== 'string') throw new Error('PROVIDER_RESPONSE_INVALID');
        // Provider names sometimes echo account data; never persist those secrets.
        const clean = [username, password].reduce((text, secret) => secret ? text.split(secret).join('[redacted]') : text, name);
        return { id: index === 2 ? row.series_id : index < 3 ? row.stream_id : row.category_id,
          name: clean, categoryId: index < 3 ? row.category_id : null };
      });
    }));
    const catalog = Object.fromEntries(CATALOG_KINDS.map((kind, index) => [kind, lists[index]]));
    normalizeCatalog(catalog); // No partial lists accepted as mass deletion.
    return catalog;
  }
}
