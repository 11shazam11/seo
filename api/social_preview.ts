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
 * Extract id from: /quest12, /quest/12, /12, etc.
 */
function extractQuestId(path: string): number | null {
  const m = path.match(/(\d+)/);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
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
      Accept: "application/vnd.github.raw+json", // ✅ key difference (no base64 handling)
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "vercel-og-renderer",
    },
  });

  if (!res.ok) {
    let details = "";
    try {
      const err = await res.json();
      details = err?.message ? ` - ${err.message}` : "";
    } catch {
      // ignore parse failure
    }
    return {
      ok: false as const,
      status: res.status,
      message: `GitHub fetch failed: ${res.status} ${res.statusText}${details}`,
      apiUrl,
    };
  }

  // Since we used RAW accept header, this is the JSON file itself.
  const json = await res.json();
  return { ok: true as const, json, apiUrl };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const siteUrl = normalizeSiteUrl(
    process.env.SITE_URL || "https://seo-sbma.vercel.app",
  );

  // Route param from rewrite: ?path=/quest/100001582
  const path = normalizePath(req.query.path);

  // Env
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
  const GITHUB_OWNER = process.env.GITHUB_OWNER || "";
  const GITHUB_REPO = process.env.GITHUB_REPO || "";
  const GITHUB_REF = process.env.GITHUB_BRANCH || "main";

  if(GITHUB_TOKEN){
    console.log(`Github token found : ${GITHUB_TOKEN}`);
  }else{
    console.log("Token not found");
  }
  // Quest id (fallback to a test id if missing)
  const questId = extractQuestId(path) ?? 100001582;

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
          if (s)
            image = /^https?:\/\//i.test(s)
              ? s
              : `${siteUrl}${s.startsWith("/") ? s : `/${s}`}`;
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

  const canonicalUrl = `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;

  // For debugging while you iterate (disable caching)
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
