import type { NextApiRequest, NextApiResponse } from 'next';
import { categories } from '../../../src/server/xtream';
import { respond } from '../../../src/server/xtream-handler';
export default function handler(req: NextApiRequest, res: NextApiResponse) { return respond(req, res, categories); }
