import type { VercelRequest, VercelResponse } from '@vercel/node';

function esc(s: any) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function baseSiteUrl() {
  return String(process.env.REACT_APP_SITE_URL || 'https://dev.lunor.ai').replace(/\/+$/, '');
}

function toInt(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function extractId(path: any): number | null {
  const m = String(path ?? '').match(/(\d{3,})/);
  return m ? toInt(m[1]) : null;
}

function fmtUnix(ts: any) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return '';
  return new Date(n * 1000).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolveImage(base: string, coverImg: any, fallback: string) {
  const raw = String(coverImg || '').trim();
  if (!raw) return fallback;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${base}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

function truncate(s: any, max = 200) {
  const str = String(s ?? '');
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}

function shortText(s: any, max = 220) {
  const str = String(s ?? '');
  if (str.length <= max) return str;
  return str.slice(0, max) + '…';
}

function requestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ---------------- GitHub fetch ---------------- */

async function fetchQuest(id: number, reqId: string) {
  const owner = process.env.GITHUB_OWNER!;
  const repo = process.env.GITHUB_REPO!;
  const ref = process.env.GITHUB_BRANCH || 'main';
  const token = process.env.GITHUB_TOKEN;

  const path = `public/quests/${id}.json`;
  const url =
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}` +
    `?ref=${encodeURIComponent(ref)}`;

  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        // NOTE: you originally used this; keep it.
        Accept: 'application/vnd.github.raw+json',
        'User-Agent': 'vercel-og',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const ms = Date.now() - started;
    const bodyText = await res.text();

    // GitHub fetch logs (always, as requested)
    console.log('[og] github_fetch', {
      reqId,
      id,
      status: res.status,
      ok: res.ok,
      ms,
      // do not leak token; only show existence outside
      url, // you said this is testing only, so okay
      bytes: bodyText.length,
      preview: shortText(bodyText, 200),
    });

    if (!res.ok) return null;

    try {
      return bodyText ? JSON.parse(bodyText) : null;
    } catch (e) {
      console.log('[og] github_json_parse_failed', {
        reqId,
        id,
        ms,
        error: String(e),
        preview: shortText(bodyText, 250),
      });
      return null;
    }
  } catch (err) {
    const ms = Date.now() - started;
    console.log('[og] github_fetch_exception', {
      reqId,
      id,
      ms,
      error: String(err),
    });
    return null;
  }
}

/* ---------------- HTML builders ---------------- */

function buildHtml(opts: {
  siteUrl: string;
  canonicalUrl: string;
  title: string;
  summary: string;
  image: string;
  questId: number | null;
  starttime: number | null;
  deadline: number | null;
  lastModified: number | null;
  mode: 'ok' | 'fallback';
  reqId: string;
}) {
  const {
    canonicalUrl,
    title,
    summary,
    image,
    questId,
    starttime,
    deadline,
    lastModified,
    mode,
    reqId,
  } = opts;

  const startStr = fmtUnix(starttime);
  const deadlineStr = fmtUnix(deadline);
  const updatedStr = fmtUnix(lastModified);

  // 🔑 Build ONE rich description used everywhere
  const baseDesc = mode === 'ok' ? truncate(summary, 220) : 'Quest preview unavailable';

  const richDescription =
    baseDesc +
    (startStr ? ` | Starts: ${startStr}` : '') +
    (deadlineStr ? ` | Deadline: ${deadlineStr}` : '');

  const body =
    mode === 'ok'
      ? `<h1>${esc(title)}</h1>
  <p>${esc(summary)}</p>
  <ul>
    ${startStr ? `<li><strong>Start:</strong> ${esc(startStr)}</li>` : ''}
    ${deadlineStr ? `<li><strong>Deadline:</strong> ${esc(deadlineStr)}</li>` : ''}
    ${updatedStr ? `<li><strong>Last updated:</strong> ${esc(updatedStr)}</li>` : ''}
  </ul>`
      : `<h1>Quest preview unavailable</h1>
  <p>This preview could not be generated right now.</p>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>

  <link rel="canonical" href="${esc(canonicalUrl)}" />

  <!-- Primary description -->
  <meta name="description" content="${esc(richDescription)}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(richDescription)}" />
  <meta property="og:url" content="${esc(canonicalUrl)}" />
  <meta property="og:image" content="${esc(image)}" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(richDescription)}" />
  <meta name="twitter:image" content="${esc(image)}" />

  <!-- Debug meta (safe) -->
  <meta name="x:reqId" content="${esc(reqId)}" />
  <meta name="x:mode" content="${esc(mode)}" />
  <meta name="quest:id" content="${esc(questId)}" />

  ${starttime ? `<meta name="quest:starttime" content="${esc(starttime)}" />` : ''}
  ${deadline ? `<meta name="quest:deadline" content="${esc(deadline)}" />` : ''}
  ${lastModified ? `<meta name="quest:last_modified_on" content="${esc(lastModified)}" />` : ''}

  <meta name="robots" content="index,follow" />
</head>
<body>
  ${body}
  <hr />
  <small>reqId: ${esc(reqId)} | mode: ${esc(mode)}</small>
</body>
</html>`;
}

/* ---------------- handler ---------------- */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const reqId = requestId();
  const siteUrl = baseSiteUrl();

  // 1) Request logs (always)
  console.log('[og] request_in', {
    reqId,
    method: req.method,
    url: req.url,
    query: req.query,
    ua: req.headers['user-agent'],
    referer: req.headers['referer'],
    // helpful for bot debugging
    xForwardedFor: req.headers['x-forwarded-for'],
  });

  // 2) ENV logs (testing only, as requested)
  console.log('[og] env_snapshot', {
    reqId,
    REACT_APP_SITE_URL: process.env.REACT_APP_SITE_URL || '(unset)',
    GITHUB_OWNER: process.env.GITHUB_OWNER || '(unset)',
    GITHUB_REPO: process.env.GITHUB_REPO || '(unset)',
    GITHUB_BRANCH: process.env.GITHUB_BRANCH || '(unset->main)',
    GITHUB_TOKEN_exists: Boolean(process.env.GITHUB_TOKEN),
    GITHUB_TOKEN_len: process.env.GITHUB_TOKEN ? String(process.env.GITHUB_TOKEN).length : 0,
  });

  const questId = toInt(req.query.id) ?? extractId(req.query.path);

  // Fallback defaults (always safe)
  let title = 'Quest';
  let summary = 'Quest details';
  let image = `${siteUrl}/og-default.png`;
  let starttime: number | null = null;
  let deadline: number | null = null;
  let lastModified: number | null = null;

  let mode: 'ok' | 'fallback' = 'fallback';
  let reason = 'no_id';

  const json = questId != null ? await fetchQuest(questId, reqId) : null;
  const q = json?.data?.fetchChallengePage;

  if (q) {
    title = q.title || title;
    summary = q.summary || summary;
    image = resolveImage(siteUrl, q.coverImg, image);
    starttime = toInt(q.starttime);
    deadline = toInt(q.deadline);
    lastModified = toInt(q.last_modified_on);
    mode = 'ok';
    reason = 'ok';
  } else {
    reason = questId == null ? 'no_id' : 'missing_q_or_fetch_failed';
  }

  // canonical: if no id, point to site root (avoid /quest/null)
  const canonicalUrl = questId != null ? `${siteUrl}/quest/${questId}` : `${siteUrl}/quest`;

  const startStr = fmtUnix(starttime);
  const deadlineStr = fmtUnix(deadline);
  const description = truncate(summary, 240);
  const metaSummaryLine =
    `${description}` +
    (startStr ? ` | Starts: ${startStr}` : '') +
    (deadlineStr ? ` | Deadline: ${deadlineStr}` : '');

  // 3) Render decision logs (always)
  console.log('[og] render_decision', {
    reqId,
    questId,
    mode,
    reason,
    hasJson: Boolean(json),
    hasQ: Boolean(q),
    title,
    image,
    starttime,
    deadline,
    lastModified,
  });

  const html = buildHtml({
    siteUrl,
    canonicalUrl,
    title: mode === 'ok' ? title : 'Quest preview unavailable',
    summary: mode === 'ok' ? summary : 'Quest details',
    image,
    questId,
    starttime,
    deadline,
    lastModified,
    mode,
    reqId,
    metaSummaryLine: mode === 'ok' ? metaSummaryLine : 'Quest preview unavailable',
  });

  // Always 200 for crawlers
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
  res.status(200).send(html);
}
