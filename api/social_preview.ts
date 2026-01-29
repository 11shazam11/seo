// // import type { VercelRequest, VercelResponse } from "@vercel/node";

// // function escapeHtml(s: string) {
// //   return s
// //     .replaceAll("&", "&amp;")
// //     .replaceAll("<", "&lt;")
// //     .replaceAll(">", "&gt;")
// //     .replaceAll('"', "&quot;")
// //     .replaceAll("'", "&#039;");
// // }

// // function normalizeSiteUrl(raw: string) {
// //   // remove trailing slashes so `${siteUrl}/file.png` is always correct
// //   return raw.replace(/\/+$/, "");
// // }

// // export default async function handler(req: VercelRequest, res: VercelResponse) {
// //   // IMPORTANT: for OG tags, images should be absolute URLs
// //   const siteUrl = normalizeSiteUrl(
// //     process.env.SITE_URL || "https://seo-sbma.vercel.app"
// //   );

// //   // Example: /quest1 or /quest2 (coming from your rewrite into ?path=...)
// //   const path = String(req.query.path ?? "/");

// //   let title = "";
// //   let description = "";
// //   let image = "";

// //   // ✅ Use images from /public as: https://domain.com/<filename>
// //   // Put these files in your React /public folder:
// //   // - public/q1.png
// //   // - public/q2.png
// //   // - public/og-default.png
// //   if (path === "/quest12") {
// //     title = "ONE PIECE";
// //     description = "Finding the one pieace and be the pirate king";
// //     image = `${siteUrl}/q1.png`;
// //   } else if (path === "/quest22") {
// //     title = "VALORANT";
// //     description = "A free to play game fps shooter game";
// //     image = `${siteUrl}/q2.png`;
// //   } else {
// //     title = "My App";
// //     description = "My app description";
// //     image = `${siteUrl}/og-default.png`;
// //   }

// //   // ✅ canonical URL (avoid the old slice(1) bug)
// //   const url = `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;

// //   // Cache on Vercel CDN to reduce function hits (seconds)
// //   res.setHeader("Content-Type", "text/html; charset=utf-8");
// //   res.setHeader(
// //     "Cache-Control",
// //     "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400"
// //   );

// //   // Optional Facebook app id (removes debugger warning if you set it)
// //   const fbAppId = process.env.FB_APP_ID || "";

// //   // Discord-friendly: include secure_url + width/height
// //   const imageWidth = "1200";
// //   const imageHeight = "630";

// //   const html = `<!doctype html>
// // <html lang="en">
// // <head>
// //   <meta charset="utf-8" />
// //   <meta name="viewport" content="width=device-width,initial-scale=1" />

// //   <title>${escapeHtml(title)}</title>
// //   <meta name="description" content="${escapeHtml(description)}" />

// //   <meta property="og:type" content="website" />
// //   <meta property="og:title" content="${escapeHtml(title)}" />
// //   <meta property="og:description" content="${escapeHtml(description)}" />
// //   <meta property="og:url" content="${escapeHtml(url)}" />

// //   <meta property="og:image" content="${escapeHtml(image)}" />
// //   <meta property="og:image:secure_url" content="${escapeHtml(image)}" />
// //   <meta property="og:image:width" content="${imageWidth}" />
// //   <meta property="og:image:height" content="${imageHeight}" />

// //   ${
// //     fbAppId
// //       ? `<meta property="fb:app_id" content="${escapeHtml(fbAppId)}" />`
// //       : ""
// //   }

// //   <meta name="twitter:card" content="summary_large_image" />
// //   <meta name="twitter:title" content="${escapeHtml(title)}" />
// //   <meta name="twitter:description" content="${escapeHtml(description)}" />
// //   <meta name="twitter:image" content="${escapeHtml(image)}" />
// // </head>
// // <body>
// //   <h1>${escapeHtml(title)}</h1>
// //   <p>${escapeHtml(description)}</p>
// //   <p><a href="${escapeHtml(url)}">Open page</a></p>
// // </body>
// // </html>`;

// //   res.status(200).send(html);
// // }
// import type { VercelRequest, VercelResponse } from "@vercel/node";

// function escapeHtml(s: string) {
//   return String(s)
//     .replaceAll("&", "&amp;")
//     .replaceAll("<", "&lt;")
//     .replaceAll(">", "&gt;")
//     .replaceAll('"', "&quot;")
//     .replaceAll("'", "&#039;");
// }

// function normalizeSiteUrl(raw: string) {
//   return String(raw || "").replace(/\/+$/, "");
// }

// function normalizePath(p: unknown) {
//   const s = String(p ?? "/");
//   return s.startsWith("/") ? s : `/${s}`;
// }

// /**
//  * Extract quest id from routes like:
//  *   /quest12   -> 12
//  *   /quest/12  -> 12
//  *   /12        -> 12
//  */
// function extractQuestId(path: string): number | null {
//   const m = path.match(/(\d+)/);
//   if (!m) return null;
//   const id = Number(m[1]);
//   return Number.isFinite(id) && id > 0 ? id : null;
// }

// function decodeBase64ToUtf8(b64: string) {
//   return Buffer.from(b64, "base64").toString("utf8");
// }

// async function fetchGithubJsonFile(opts: {
//   owner: string;
//   repo: string;
//   branch: string;
//   filePath: string; // e.g. public/quests/12.json
//   token: string;
// }) {
//   const { owner, repo, branch, filePath, token } = opts;

//   const apiUrl = `https://api.github.com/repos/${encodeURIComponent(
//     owner
//   )}/${encodeURIComponent(repo)}/contents/${filePath
//     .split("/")
//     .map(encodeURIComponent)
//     .join("/")}?ref=${encodeURIComponent(branch)}`;

//   const r = await fetch(apiUrl, {
//     headers: {
//       Authorization: `Bearer ${token}`,
//       Accept: "application/vnd.github+json",
//       "User-Agent": "vercel-og-renderer",
//     },
//   });

//   const remaining = r.headers.get("x-ratelimit-remaining");
//   const reset = r.headers.get("x-ratelimit-reset");

//   if (r.status === 404) return { ok: false as const, status: 404 as const };

//   if (!r.ok) {
//     const text = await r.text().catch(() => "");
//     return {
//       ok: false as const,
//       status: r.status,
//       message: `GitHub API error ${r.status}. remaining=${remaining ?? "?"}, reset=${reset ?? "?"}. body=${text.slice(
//         0,
//         300
//       )}`,
//     };
//   }

//   const payload: any = await r.json();

//   if (!payload || payload.type !== "file" || typeof payload.content !== "string") {
//     return {
//       ok: false as const,
//       status: 500,
//       message: "Unexpected GitHub response shape (not a file).",
//     };
//   }

//   const raw = decodeBase64ToUtf8(payload.content.replace(/\n/g, ""));
//   let json: any;
//   try {
//     json = JSON.parse(raw);
//   } catch {
//     return {
//       ok: false as const,
//       status: 500,
//       message: "GitHub file is not valid JSON.",
//     };
//   }

//   return { ok: true as const, json };
// }

// export default async function handler(req: VercelRequest, res: VercelResponse) {
//   const siteUrl = normalizeSiteUrl(process.env.SITE_URL || "https://seo-sbma.vercel.app");
//   const path = normalizePath(req.query.path);

//   // Vercel env vars
//   const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
//   const GITHUB_OWNER = process.env.GITHUB_OWNER || "";
//   const GITHUB_REPO = process.env.GITHUB_REPO || "";
//   const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";

//   const questId = extractQuestId(path);

//   // Defaults (fallback)
//   let title = "My App";
//   let description = "My app description";
//   let image = `${siteUrl}/og-default.png`;

//   if (questId && GITHUB_TOKEN && GITHUB_OWNER && GITHUB_REPO) {
//     // ✅ MATCHES your build_quest.ts output:
//     // public/quests/<id>.json
//     const filePath = `public/quests/${questId}.json`;

//     const gh = await fetchGithubJsonFile({
//       owner: GITHUB_OWNER,
//       repo: GITHUB_REPO,
//       branch: GITHUB_BRANCH,
//       filePath,
//       token: GITHUB_TOKEN,
//     });

//     if (gh.ok) {
//       // ✅ MATCHES your JSON shape:
//       // { data: { fetchChallengePage: { title, summary, coverImg, ... } } }
//       const q = gh.json?.data?.fetchChallengePage;

//       if (q) {
//         title = String(q.title ?? title);
//         description = String(q.summary ?? description);

//         const img = q.coverImg;
//         if (img) {
//           const s = String(img);
//           image = /^https?:\/\//i.test(s) ? s : `${siteUrl}${s.startsWith("/") ? s : `/${s}`}`;
//         }
//       }
//     } else if (gh.status !== 404) {
//       console.error("GitHub fetch failed:", (gh as any).message || gh);
//     }
//   }

//   const url = `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;

//   res.setHeader("Content-Type", "text/html; charset=utf-8");
//   res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");

//   const fbAppId = process.env.FB_APP_ID || "";
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

//   ${fbAppId ? `<meta property="fb:app_id" content="${escapeHtml(fbAppId)}" />` : ""}

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

function decodeBase64ToUtf8(b64: string) {
  return Buffer.from(b64, "base64").toString("utf8");
}

function maskToken(tok: string) {
  if (!tok) return "";
  const t = String(tok);
  if (t.length <= 10) return `${t.slice(0, 2)}…${t.slice(-2)}`;
  return `${t.slice(0, 4)}…${t.slice(-4)} (len=${t.length})`;
}

function safeJson(obj: any) {
  try {
    return JSON.stringify(obj);
  } catch {
    return "[unstringifiable]";
  }
}

async function readBodySnippet(r: Response, max = 600) {
  try {
    const t = await r.text();
    return t.slice(0, max);
  } catch {
    return "";
  }
}

async function fetchGithubJsonFile(opts: {
  owner: string;
  repo: string;
  branch: string;
  filePath: string; // e.g. public/quests/100001584.json
  token: string;
  requestId: string;
}) {
  const { owner, repo, branch, filePath, token, requestId } = opts;

  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(
    owner,
  )}/${encodeURIComponent(repo)}/contents/${filePath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}?ref=${encodeURIComponent(branch)}`;

  console.log(`[${requestId}] GH: url=${apiUrl}`);
  console.log(
    `[${requestId}] GH: env owner=${owner} repo=${repo} branch=${branch} token=${maskToken(
      token,
    )}`,
  );

  let r: Response;
  try {
    r = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "vercel-og-renderer",
      },
    });
  } catch (e: any) {
    console.error(`[${requestId}] GH: network error`, e?.message || e);
    return {
      ok: false as const,
      status: 599 as const,
      message: `Network error calling GitHub: ${String(e?.message || e)}`,
      apiUrl,
    };
  }

  const remaining = r.headers.get("x-ratelimit-remaining");
  const reset = r.headers.get("x-ratelimit-reset");
  const ghReqId = r.headers.get("x-github-request-id");
  const wwwAuth = r.headers.get("www-authenticate") || "";

  console.log(
    `[${requestId}] GH: status=${r.status} ok=${r.ok} remaining=${remaining ?? "?"} reset=${reset ?? "?"} x-github-request-id=${ghReqId ?? "?"}`,
  );

  // Helpful for 401/403 debugging (token/scopes/auth scheme)
  if (r.status === 401 || r.status === 403) {
    console.error(
      `[${requestId}] GH: AUTH FAIL status=${r.status} www-authenticate=${wwwAuth}`,
    );
  }

  if (r.status === 404) {
    console.warn(`[${requestId}] GH: 404 not found filePath=${filePath}`);
    return { ok: false as const, status: 404 as const, apiUrl };
  }

  if (!r.ok) {
    const body = await readBodySnippet(r);
    console.error(
      `[${requestId}] GH: error status=${r.status} body_snippet=${body}`,
    );
    return {
      ok: false as const,
      status: r.status,
      message: `GitHub API error ${r.status}. remaining=${remaining ?? "?"}, reset=${reset ?? "?"}, x-github-request-id=${ghReqId ?? "?"}, www-authenticate=${wwwAuth}. body=${body}`,
      apiUrl,
    };
  }

  let payload: any;
  try {
    payload = await r.json();
  } catch (e: any) {
    const body = await readBodySnippet(r);
    console.error(
      `[${requestId}] GH: failed to parse JSON response. body_snippet=${body}`,
    );
    return {
      ok: false as const,
      status: 500,
      message: `GitHub response not JSON. body=${body}`,
      apiUrl,
    };
  }

  if (
    !payload ||
    payload.type !== "file" ||
    typeof payload.content !== "string"
  ) {
    console.error(
      `[${requestId}] GH: unexpected payload shape type=${payload?.type} keys=${Object.keys(
        payload || {},
      ).join(",")}`,
    );
    return {
      ok: false as const,
      status: 500,
      message: "Unexpected GitHub response shape (not a file).",
      apiUrl,
    };
  }

  const b64 = payload.content.replace(/\n/g, "");
  let raw = "";
  try {
    raw = decodeBase64ToUtf8(b64);
  } catch (e: any) {
    console.error(`[${requestId}] GH: base64 decode failed`, e?.message || e);
    return {
      ok: false as const,
      status: 500,
      message: "Failed to decode GitHub base64 content.",
      apiUrl,
    };
  }

  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    console.error(
      `[${requestId}] GH: file content is not valid JSON. raw_snippet=${raw.slice(
        0,
        600,
      )}`,
    );
    return {
      ok: false as const,
      status: 500,
      message: "GitHub file is not valid JSON.",
      apiUrl,
    };
  }

  console.log(
    `[${requestId}] GH: success parsed JSON. top_keys=${Object.keys(json || {}).join(",")}`,
  );

  return { ok: true as const, json, apiUrl };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId =
    (req.headers["x-vercel-id"] as string) ||
    (req.headers["x-request-id"] as string) ||
    `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const siteUrl = normalizeSiteUrl(
    process.env.SITE_URL || "https://seo-sbma.vercel.app",
  );

  // ✅ Hardcoded quest id for testing
  const TEST_QUEST_ID = 100001584;

  // Vercel env vars
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
  const GITHUB_OWNER = process.env.GITHUB_OWNER || "";
  const GITHUB_REPO = process.env.GITHUB_REPO || "";
  const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";

  console.log(
    `[${requestId}] START path=${req.url} method=${req.method} ua=${String(
      req.headers["user-agent"] || "",
    ).slice(0, 120)}`,
  );

  // Defaults (fallback)
  let title = "My App";
  let description = "My app description";
  let image = `${siteUrl}/og-default.png`;

  // ✅ Always attempt GitHub API fetch (for testing)
  if (GITHUB_TOKEN && GITHUB_OWNER && GITHUB_REPO) {
    const filePath = `public/quests/${TEST_QUEST_ID}.json`;

    const gh = await fetchGithubJsonFile({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      branch: GITHUB_BRANCH,
      filePath,
      token: GITHUB_TOKEN,
      requestId,
    });

    if (gh.ok) {
      const q = gh.json?.data?.fetchChallengePage;

      // Log shape quickly (helps when JSON path is wrong)
      console.log(
        `[${requestId}] GH JSON shape: has_data=${Boolean(
          gh.json?.data,
        )} has_fetchChallengePage=${Boolean(q)} q_keys=${
          q ? Object.keys(q).join(",") : ""
        }`,
      );

      if (q) {
        title = String(q.title ?? title);
        description = String(q.summary ?? description);

        const img = q.coverImg;
        if (img) {
          const s = String(img);
          image = /^https?:\/\//i.test(s)
            ? s
            : `${siteUrl}${s.startsWith("/") ? s : `/${s}`}`;
        }
      }
    } else {
      console.error(
        `[${requestId}] GH fetch failed status=${gh.status} apiUrl=${(gh as any).apiUrl} message=${(gh as any).message || ""}`,
      );
    }
  } else {
    console.error(
      `[${requestId}] Missing GitHub envs: ${safeJson({
        hasToken: Boolean(GITHUB_TOKEN),
        hasOwner: Boolean(GITHUB_OWNER),
        hasRepo: Boolean(GITHUB_REPO),
        branch: GITHUB_BRANCH,
      })}`,
    );
  }

  const url = `${siteUrl}/quest/${TEST_QUEST_ID}`;

  // res.setHeader("Content-Type", "text/html; charset=utf-8");
  // res.setHeader(
  //   "Cache-Control",
  //   "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  // );
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, max-age=0",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const fbAppId = process.env.FB_APP_ID || "";
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

  ${fbAppId ? `<meta property="fb:app_id" content="${escapeHtml(fbAppId)}" />` : ""}

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <pre style="white-space:pre-wrap;font-size:12px;opacity:.75">requestId=${escapeHtml(
    requestId,
  )}</pre>
</body>
</html>`;

  console.log(
    `[${requestId}] DONE title=${title.slice(0, 80)} image=${image.slice(0, 120)}`,
  );

  res.status(200).send(html);
}
