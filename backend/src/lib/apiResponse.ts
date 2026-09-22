import type { Response } from "express";

export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ ok: true, data });
}

export function err(res: Response, message: string, status = 400, details?: unknown): void {
  res.status(status).json({ ok: false, error: message, ...(details ? { details } : {}) });
}

/** Wraps an async route handler and forwards thrown errors as JSON. */
export function wrap(
  fn: (req: import("express").Request, res: import("express").Response) => Promise<void>,
): import("express").RequestHandler {
  return (req, res, next) => {
    fn(req, res).catch((e: unknown) => {
      const status = (e as { statusCode?: number }).statusCode ?? 500;
      const message = status >= 500 ? "Internal server error" : e instanceof Error ? e.message : "Request failed";
      if (status >= 500) console.error(e);
      err(res, message, status);
      next; // keep signature; never call next so express default handler is skipped
    });
  };
}
