// import type { VercelRequest, VercelResponse } from "@vercel/node";

// function escapeHtml(s: string) {
//   return s
//     .replaceAll("&", "&amp;")
//     .replaceAll("<", "&lt;")
//     .replaceAll(">", "&gt;")
//     .replaceAll('"', "&quot;")
//     .replaceAll("'", "&#039;");
// }

// function normalizeSiteUrl(raw: string) {
//   // remove trailing slashes so `${siteUrl}/file.png` is always correct
//   return raw.replace(/\/+$/, "");
// }

// export default async function handler(req: VercelRequest, res: VercelResponse) {
//   // IMPORTANT: for OG tags, images should be absolute URLs
//   const siteUrl = normalizeSiteUrl(
//     process.env.SITE_URL || "https://seo-sbma.vercel.app"
//   );

//   // Example: /quest1 or /quest2 (coming from your rewrite into ?path=...)
//   const path = String(req.query.path ?? "/");

//   let title = "";
//   let description = "";
//   let image = "";

//   // ✅ Use images from /public as: https://domain.com/<filename>
//   // Put these files in your React /public folder:
//   // - public/q1.png
//   // - public/q2.png
//   // - public/og-default.png
//   if (path === "/quest12") {
//     title = "ONE PIECE";
//     description = "Finding the one pieace and be the pirate king";
//     image = `${siteUrl}/q1.png`;
//   } else if (path === "/quest22") {
//     title = "VALORANT";
//     description = "A free to play game fps shooter game";
//     image = `${siteUrl}/q2.png`;
//   } else {
//     title = "My App";
//     description = "My app description";
//     image = `${siteUrl}/og-default.png`;
//   }

//   // ✅ canonical URL (avoid the old slice(1) bug)
//   const url = `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;

//   // Cache on Vercel CDN to reduce function hits (seconds)
//   res.setHeader("Content-Type", "text/html; charset=utf-8");
//   res.setHeader(
//     "Cache-Control",
//     "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400"
//   );

//   // Optional Facebook app id (removes debugger warning if you set it)
//   const fbAppId = process.env.FB_APP_ID || "";

//   // Discord-friendly: include secure_url + width/height
//   const imageWidth = "1200";
//   const imageHeight = "630";

//   const html = `<!doctype html>
// <html lang="en">
// <head>
//   <meta charset="utf-8" />
//   <meta name="viewport" content="width=device-width,initial-scale=1" />

//   <title>${escapeHtml(title)}</title>
//   <meta name="description" content="${escapeHtml(description)}" />

//   <meta property="og:type" content="website" />
//   <meta property="og:title" content="${escapeHtml(title)}" />
//   <meta property="og:description" content="${escapeHtml(description)}" />
//   <meta property="og:url" content="${escapeHtml(url)}" />

//   <meta property="og:image" content="${escapeHtml(image)}" />
//   <meta property="og:image:secure_url" content="${escapeHtml(image)}" />
//   <meta property="og:image:width" content="${imageWidth}" />
//   <meta property="og:image:height" content="${imageHeight}" />

//   ${
//     fbAppId
//       ? `<meta property="fb:app_id" content="${escapeHtml(fbAppId)}" />`
//       : ""
//   }

//   <meta name="twitter:card" content="summary_large_image" />
//   <meta name="twitter:title" content="${escapeHtml(title)}" />
//   <meta name="twitter:description" content="${escapeHtml(description)}" />
//   <meta name="twitter:image" content="${escapeHtml(image)}" />
// </head>
// <body>
//   <h1>${escapeHtml(title)}</h1>
//   <p>${escapeHtml(description)}</p>
//   <p><a href="${escapeHtml(url)}">Open page</a></p>
// </body>
// </html>`;

//   res.status(200).send(html);
// }
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
 * Extract quest id from routes like:
 *   /quest12   -> 12
 *   /quest/12  -> 12
 *   /12        -> 12
 */
function extractQuestId(path: string): number | null {
  const m = path.match(/(\d+)/);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function decodeBase64ToUtf8(b64: string) {
  return Buffer.from(b64, "base64").toString("utf8");
}

async function fetchGithubJsonFile(opts: {
  owner: string;
  repo: string;
  branch: string;
  filePath: string; // e.g. data/quests/12.json
  token: string;
}) {
  const { owner, repo, branch, filePath, token } = opts;

  // GitHub Contents API
  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(
    owner
  )}/${encodeURIComponent(repo)}/contents/${filePath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}?ref=${encodeURIComponent(branch)}`;

  const r = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "vercel-og-renderer",
    },
  });

  // Helpful debugging info if rate-limited / forbidden
  const remaining = r.headers.get("x-ratelimit-remaining");
  const reset = r.headers.get("x-ratelimit-reset");

  if (r.status === 404) return { ok: false as const, status: 404 as const };
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return {
      ok: false as const,
      status: r.status,
      error: 1,
      message: `GitHub API error ${r.status}. remaining=${remaining ?? "?"}, reset=${reset ?? "?"}. body=${text.slice(
        0,
        300
      )}`,
    };
  }

  const payload: any = await r.json();

  // Contents API returns file content as base64 when it's a file
  if (!payload || payload.type !== "file" || typeof payload.content !== "string") {
    return {
      ok: false as const,
      status: 500,
      error: 2,
      message: "Unexpected GitHub response shape (not a file).",
    };
  }

  const raw = decodeBase64ToUtf8(payload.content.replace(/\n/g, ""));
  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    return {
      ok: false as const,
      status: 500,
      error: 3,
      message: "GitHub file is not valid JSON.",
    };
  }

  return { ok: true as const, json };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // IMPORTANT: for OG tags, images should be absolute URLs
  const siteUrl = normalizeSiteUrl(process.env.SITE_URL || "https://seo-sbma.vercel.app");

  // Example: /quest12 or /quest/12 (coming from your rewrite into ?path=...)
  const path = normalizePath(req.query.path);

  // --- GitHub config (set these in Vercel env vars) ---
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
  const GITHUB_OWNER = process.env.GITHUB_OWNER || "";
  const GITHUB_REPO = process.env.GITHUB_REPO || "";
  const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";

  // If you prefer a fixed repo layout:
  // data/quests/<id>.json
  const questId = extractQuestId(path);

  let title = "My App";
  let description = "My app description";
  let image = `${siteUrl}/og-default.png`;

  // Fetch quest data from GitHub only if we have an id + config
  if (questId && GITHUB_TOKEN && GITHUB_OWNER && GITHUB_REPO) {
    const filePath = `data/quests/${questId}.json`;

    const gh = await fetchGithubJsonFile({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      branch: GITHUB_BRANCH,
      filePath,
      token: GITHUB_TOKEN,
    });

    if (gh.ok) {
      // Map your JSON fields here (edit these names to match your real JSON)
      // Supported common keys: title, summary/description, coverImg/image
      const q = gh.json ?? {};
      title = String(q.title ?? q.name ?? title);
      description = String(q.summary ?? q.description ?? description);

      const img = q.coverImg ?? q.cover_img ?? q.image ?? q.ogImage;
      if (img) {
        // If repo stores relative image paths, convert to absolute:
        // - already absolute => keep
        // - relative => prefix with siteUrl
        const s = String(img);
        image = /^https?:\/\//i.test(s) ? s : `${siteUrl}${s.startsWith("/") ? s : `/${s}`}`;
      }
    } else if (gh.status !== 404) {
      // If GitHub is failing (rate limit / token / etc), surface a deterministic fallback
      // (don’t leak secrets; message is trimmed)
      console.error("GitHub fetch failed:", (gh as any).message || gh);
    }
    // If 404, we just keep fallback OG values.
  }

  // ✅ canonical URL
  const url = `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;

  // Cache on Vercel CDN to reduce function hits (seconds)
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400"
  );

  // Optional Facebook app id (removes debugger warning if you set it)
  const fbAppId = process.env.FB_APP_ID || "";

  // Discord-friendly: include secure_url + width/height
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
  <meta property="og:url" content="${escapeHtml(url)}" />

  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(image)}" />
  <meta property="og:image:width" content="${imageWidth}" />
  <meta property="og:image:height" content="${imageHeight}" />

  ${
    fbAppId
      ? `<meta property="fb:app_id" content="${escapeHtml(fbAppId)}" />`
      : ""
  }

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <p><a href="${escapeHtml(url)}">Open page</a></p>
</body>
</html>`;

  res.status(200).send(html);
}

