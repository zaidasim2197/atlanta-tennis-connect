import type { VercelRequest, VercelResponse } from "@vercel/node";
import { bootstrap } from "./_lib/handler";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await bootstrap(req, res);
}
