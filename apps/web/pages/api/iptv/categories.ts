import type { NextApiRequest, NextApiResponse } from 'next';
import { categories } from '../../../src/server/xtream';
import { respond } from '../../../src/server/xtream-handler';
import { enforceRateLimit } from '../../../src/server/rate-limit';
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!enforceRateLimit(req, res, { bucket: 'catalog' })) return;
  return respond(req, res, categories);
}
