/**
 * 愛車紀錄 MyGarage — Cloudflare Worker（v3.2.0：通行碼 + 內部金鑰）
 * ------------------------------------------------------------------
 * 手機 App ──(Authorization: Bearer <通行碼>)──> 這個 Worker ──(key=<內部金鑰>)──> Apps Script
 *
 * Cloudflare Workers 免費版可用。需要兩個 Secrets（Worker → 設定 → 變數和密碼 → 密碼）：
 *   PASSCODE         你在手機 App 輸入的通行碼（至少 16 個隨機字元，建議用密碼管理器產生）
 *   APPS_SCRIPT_KEY  Apps Script「指令碼屬性」API_KEY 的同一個值（至少 16 個隨機字元）
 * 任何一個沒設定或太短 → 一律拒絕所有請求（fail closed）。
 *
 * 安全設計：
 *   - 每個請求（含 ping）都要通行碼；來源（Origin）檢查只是額外限制，不是驗證。
 *   - 前端送來的 key 一律丟棄，只由這裡附上內部金鑰；通行碼不會轉給 Apps Script。
 *   - 只轉發白名單內的 action 與參數；回應不含上游網址或例外文字。
 *
 * 這個檔案放在倉庫中僅作「備份與版本記錄」用，不會從這裡執行。
 * 實際運行的程式在 Cloudflare → Workers & Pages。
 */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/【你的部署ID】/exec';
const ALLOWED_ORIGINS = new Set(['https://188subd.github.io']);
const ALLOWED_ACTIONS = new Set(['ping', 'all', 'addVehicle', 'addFuel', 'addMaint', 'undoRecord']);
const MIN_SECRET_LENGTH = 16;
const MAX_PAYLOAD_LENGTH = 8000;
const MAX_REQID_LENGTH = 100;
const UPSTREAM_TIMEOUT_MS = 40000;   // 小於前端的 45 秒逾時

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    // 預檢請求不需通行碼（瀏覽器不會在預檢帶 Authorization）
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'GET') {
      return json({ ok: false, error: 'Method not allowed' }, 405, cors);
    }
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return json({ ok: false, error: 'Origin not allowed' }, 403, cors);
    }

    // fail closed：兩個秘密缺漏、不是字串、或太短 → 拒絕一切
    if (!validSecret(env && env.PASSCODE) || !validSecret(env && env.APPS_SCRIPT_KEY)) {
      return json({ ok: false, error: 'server not configured' }, 500, cors);
    }

    const supplied = bearer(request.headers.get('Authorization'));
    if (!(await secureEqual(supplied, env.PASSCODE))) {
      return json({ ok: false, error: 'unauthorized' }, 401, cors);
    }

    const incoming = new URL(request.url);
    const action = incoming.searchParams.get('action') || 'all';
    if (!ALLOWED_ACTIONS.has(action)) {
      return json({ ok: false, error: 'unknown action' }, 400, cors);
    }
    const payload = incoming.searchParams.get('payload');
    if (payload !== null && payload.length > MAX_PAYLOAD_LENGTH) {
      return json({ ok: false, error: 'payload too large' }, 413, cors);
    }
    const reqId = incoming.searchParams.get('reqId');
    if (reqId !== null && reqId.length > MAX_REQID_LENGTH) {
      return json({ ok: false, error: 'bad request id' }, 400, cors);   // 不要默默丟掉（會破壞重複寫入防護）
    }

    // 只轉發白名單參數；key 一律由這裡附上（絕不採用前端送來的值）
    const upstream = new URL(APPS_SCRIPT_URL);
    upstream.searchParams.set('action', action);
    if (payload !== null) upstream.searchParams.set('payload', payload);
    if (reqId !== null) upstream.searchParams.set('reqId', reqId);
    upstream.searchParams.set('key', env.APPS_SCRIPT_KEY);
    upstream.searchParams.set('_proxy_ts', Date.now().toString());

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const response = await fetch(upstream.toString(), {
        method: 'GET',
        redirect: 'follow',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
        cf: { cacheTtl: 0, cacheEverything: false }
      });
      const text = await response.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
      if (!response.ok || parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return json({ ok: false, error: 'upstream error' }, 502, cors);
      }
      // 後端回 unauthorized = Worker 與 Apps Script 的內部金鑰不一致（不是使用者的通行碼錯）：
      // 回 502 upstream_auth，前端因此不會清掉正確的通行碼
      if (parsed.ok === false && parsed.error === 'unauthorized') {
        return json({ ok: false, error: 'upstream_auth' }, 502, cors);
      }
      const headers = new Headers(cors);
      headers.set('Content-Type', 'application/json; charset=utf-8');
      headers.set('Cache-Control', 'no-store, max-age=0');
      return new Response(JSON.stringify(parsed), { status: 200, headers });
    } catch (error) {
      return json({ ok: false, error: 'upstream error' }, 502, cors);
    } finally {
      clearTimeout(timer);
    }
  }
};

function validSecret(v) {
  return typeof v === 'string' && v.length >= MIN_SECRET_LENGTH;
}

function bearer(header) {
  if (typeof header !== 'string') return '';
  const m = header.match(/^Bearer (.+)$/);
  return m ? m[1] : '';
}

// 固定時間比較：先各自做 SHA-256，再逐位元組比較摘要
async function secureEqual(a, b) {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(a))),
    crypto.subtle.digest('SHA-256', enc.encode(String(b)))
  ]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function corsHeaders(origin) {
  const h = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin'
  };
  // 只對允許的來源回 Allow-Origin；其他來源的瀏覽器會因此無法讀取回應
  if (ALLOWED_ORIGINS.has(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

function json(value, status, extraHeaders) {
  const headers = new Headers(extraHeaders);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(value), { status, headers });
}
