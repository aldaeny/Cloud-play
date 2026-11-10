import type { NextApiRequest, NextApiResponse } from 'next';
import { channels, CatalogError } from '../../../src/server/xtream';
import { respond } from '../../../src/server/xtream-handler';
import { enforceRateLimit } from '../../../src/server/rate-limit';
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!enforceRateLimit(req, res, { bucket: 'catalog' })) return;
  return respond(req, res, () => { const category = req.query.categoryId; if (typeof category !== 'string') throw new CatalogError('INVALID_CATEGORY'); return channels(category);
});
}
