/**
 * 愛車紀錄 MyGarage — Cloudflare Worker CORS 代理
 * ------------------------------------------------
 * 用途:iPhone/iPad Safari 的「防止跨網站追蹤」會阻擋網頁直接讀取
 *      Google Apps Script,透過這個 Worker 中轉即可正常運作。
 *
 * 這個檔案放在倉庫中僅作「備份與版本記錄」用,不會從這裡執行。
 * 實際運行的程式在 Cloudflare → Workers & Pages。
 * 若在 Cloudflare 上修改了程式,請同步更新這個檔案。
 *
 * 部署:Cloudflare → Workers & Pages → 建立 Worker → 貼上本檔 →
 *      填入下方 APPS_SCRIPT_URL → 部署
 */

/**
 * 愛車紀錄 Apps Script CORS Proxy
 * Cloudflare Workers 免費版可用。
 * 部署前把 APPS_SCRIPT_URL 改成你的 /exec 網址。
 */
// ⚠️ 部署到 Cloudflare 時,把下面這行換成你的 Apps Script /exec 網址
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/【你的部署ID】/exec';
const ALLOWED_ORIGINS = new Set([
  'https://188subd.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000'
]);

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'GET') {
      return json({ ok: false, error: 'Method not allowed' }, 405, cors);
    }
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return json({ ok: false, error: 'Origin not allowed' }, 403, cors);
    }

    const incoming = new URL(request.url);
    const upstream = new URL(APPS_SCRIPT_URL);
    incoming.searchParams.forEach((value, key) => upstream.searchParams.set(key, value));
    upstream.searchParams.delete('callback');
    upstream.searchParams.delete('mode');
    upstream.searchParams.set('_proxy_ts', Date.now().toString());

    try {
      const response = await fetch(upstream.toString(), {
        method: 'GET',
        redirect: 'follow',
        headers: { 'Accept': 'application/json' },
        cf: { cacheTtl: 0, cacheEverything: false }
      });
      const body = await response.text();
      const headers = new Headers(cors);
      headers.set('Content-Type', 'application/json; charset=utf-8');
      headers.set('Cache-Control', 'no-store, max-age=0');
      headers.set('X-Upstream-Status', String(response.status));
      return new Response(body, { status: response.ok ? 200 : 502, headers });
    } catch (error) {
      return json({ ok: false, error: String(error) }, 502, cors);
    }
  }
};

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://188subd.github.io';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(value, status, extraHeaders) {
  const headers = new Headers(extraHeaders);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(value), { status, headers });
}
