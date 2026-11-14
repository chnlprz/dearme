// Dear Me, server. Phase 1: serves the app and a health check.
// Phase 9 adds passkey sign-in on the shared Innova Space accounts (RP ID innovaspace.app) and sync in Dear Me's own
// tables; Phase 10 adds Gentle Help through the Claude API (secret ANTHROPIC_API_KEY). No data is shared with other apps.

interface Env {
  ASSETS: Fetcher;
  RP_ID: string;
}

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), { ...init, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...(init.headers ?? {}) } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/api/health') return json({ ok: true, app: 'dearme', phase: 1 });
    if (url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, { status: 404 });
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
