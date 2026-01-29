import type { VercelRequest, VercelResponse } from "@vercel/node";

function escapeHtml(s: string) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeSiteUrl(raw: string) {
  return String(raw || "").replace(/\/+$/, "");
}

function normalizePath(p: unknown) {
  const s = String(p ?? "/");
  return s.startsWith("/") ? s : `/${s}`;
}

/**
 * Extract id from: /quest/100001577, /quest12, /12, etc.
 */
function extractQuestIdFromString(s: string): number | null {
  const m = String(s || "").match(/(\d+)/);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Prefer: req.query.id (from rewrite). Fallback: req.query.path, then req.url.
 */
function getQuestId(req: VercelRequest): number | null {
  // 1) Best: /quest/:id rewritten to /api/render/quest?id=:id
  const qid = req.query?.id;
  if (typeof qid === "string") {
    const id = Number(qid);
    if (Number.isFinite(id) && id > 0) return id;
  }
  if (Array.isArray(qid) && qid.length) {
    const id = Number(qid[0]);
    if (Number.isFinite(id) && id > 0) return id;
  }

  // 2) Fallback: old rewrite style ?path=/quest/100001577
  const qpath = req.query?.path;
  if (typeof qpath === "string") {
    const id = extractQuestIdFromString(qpath);
    if (id) return id;
  }
  if (Array.isArray(qpath) && qpath.length) {
    const id = extractQuestIdFromString(qpath[0]);
    if (id) return id;
  }

  // 3) Fallback: parse req.url
  const urlPath = String(req.url || "");
  return extractQuestIdFromString(urlPath);
}

async function fetchQuestJsonRaw(opts: {
  owner: string;
  repo: string;
  ref: string;
  path: string; // public/quests/<id>.json
  token: string;
}) {
  const { owner, repo, ref, path, token } = opts;

  const apiUrl =
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}` +
    `?ref=${encodeURIComponent(ref)}`;

  const res = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.raw+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "vercel-og-renderer",
    },
  });

  if (!res.ok) {
    let details = "";
    try {
      const err = await res.json();
      details = err?.message ? ` - ${err.message}` : "";
    } catch {}
    return {
      ok: false as const,
      status: res.status,
      message: `GitHub fetch failed: ${res.status} ${res.statusText}${details}`,
      apiUrl,
    };
  }

  const json = await res.json();
  return { ok: true as const, json, apiUrl };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const siteUrl = normalizeSiteUrl(
    process.env.SITE_URL || "https://seo-sbma.vercel.app",
  );

  // ✅ Extract questId from the real URL (via rewrite id param)
  const questId = getQuestId(req) ?? 100001577;

  // ✅ The canonical public URL path should be /quest/<id>
  const publicPath = `/quest/${questId}`;

  // Env
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
  const GITHUB_OWNER = process.env.GITHUB_OWNER || "";
  const GITHUB_REPO = process.env.GITHUB_REPO || "";
  const GITHUB_REF = process.env.GITHUB_BRANCH || "main";

  // Defaults
  let title = "My App";
  let description = "My app description";
  let image = `${siteUrl}/og-default.png`;

  if (GITHUB_TOKEN && GITHUB_OWNER && GITHUB_REPO) {
    const filePath = `public/quests/${questId}.json`;

    const gh = await fetchQuestJsonRaw({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      ref: GITHUB_REF,
      path: filePath,
      token: GITHUB_TOKEN,
    });

    if (gh.ok) {
      const q = gh.json?.data?.fetchChallengePage;
      if (q) {
        title = String(q.title ?? title);
        description = String(q.summary ?? description);

        const img = q.coverImg;
        if (img) {
          const s = String(img).trim();
          if (s) {
            image = /^https?:\/\//i.test(s)
              ? s
              : `${siteUrl}${s.startsWith("/") ? s : `/${s}`}`;
          }
        }
      }
    } else {
      console.error(gh.message, { apiUrl: gh.apiUrl, filePath });
    }
  } else {
    console.error("Missing GitHub envs", {
      hasToken: Boolean(GITHUB_TOKEN),
      hasOwner: Boolean(GITHUB_OWNER),
      hasRepo: Boolean(GITHUB_REPO),
      ref: GITHUB_REF,
    });
  }

  const canonicalUrl = `${siteUrl}${publicPath}`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, max-age=0",
  );

  const imageWidth = "1200";
  const imageHeight = "630";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />

  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />

  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />

  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(image)}" />
  <meta property="og:image:width" content="${imageWidth}" />
  <meta property="og:image:height" content="${imageHeight}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
</body>
</html>`;

  res.status(200).send(html);
}
