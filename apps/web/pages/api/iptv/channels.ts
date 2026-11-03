import type { NextApiRequest, NextApiResponse } from 'next';
import { channels, CatalogError } from '../../../src/server/xtream';
import { respond } from '../../../src/server/xtream-handler';
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return respond(req, res, () => { const category = req.query.categoryId; if (typeof category !== 'string') throw new CatalogError('INVALID_CATEGORY'); return channels(category); });
}
