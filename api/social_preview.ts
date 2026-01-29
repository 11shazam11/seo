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

async function fetchGithubJsonFile(opts: {
  owner: string;
  repo: string;
  branch: string;
  filePath: string; // e.g. public/quests/100001584.json
  token: string;
}) {
  const { owner, repo, branch, filePath, token } = opts;

  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(
    owner,
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

  const remaining = r.headers.get("x-ratelimit-remaining");
  const reset = r.headers.get("x-ratelimit-reset");

  if (r.status === 404) return { ok: false as const, status: 404 as const };

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return {
      ok: false as const,
      status: r.status,
      message: `GitHub API error ${r.status}. remaining=${remaining ?? "?"}, reset=${reset ?? "?"}. body=${text.slice(
        0,
        300,
      )}`,
    };
  }

  const payload: any = await r.json();

  if (
    !payload ||
    payload.type !== "file" ||
    typeof payload.content !== "string"
  ) {
    return {
      ok: false as const,
      status: 500,
      message: "Unexpected GitHub response shape (not a file).",
    };
  }

  const raw = decodeBase64ToUtf8(payload.content.replace(/\n/g, ""));
  try {
    return { ok: true as const, json: JSON.parse(raw) };
  } catch {
    return {
      ok: false as const,
      status: 500,
      message: "GitHub file is not valid JSON.",
    };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const siteUrl = normalizeSiteUrl(
    process.env.SITE_URL || "https://seo-sbma.vercel.app",
  );

  // ✅ Hardcoded quest id for testing (NO extraction)
  const TEST_QUEST_ID = 100001584;

  // Vercel env vars
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
  const GITHUB_OWNER = process.env.GITHUB_OWNER || "";
  const GITHUB_REPO = process.env.GITHUB_REPO || "";
  const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";

  // Defaults (fallback)
  let title = "My App";
  let description = "My app description";
  let image = `${siteUrl}/og-default.png`;

  // ✅ Always attempt GitHub API fetch (for testing)
  if (GITHUB_TOKEN && GITHUB_OWNER && GITHUB_REPO) {
    // matches build output: public/quests/<id>.json
    const filePath = `public/quests/${TEST_QUEST_ID}.json`;

    const gh = await fetchGithubJsonFile({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      branch: GITHUB_BRANCH,
      filePath,
      token: GITHUB_TOKEN,
    });

    if (gh.ok) {
      // expected shape: { data: { fetchChallengePage: { title, summary, coverImg } } }
      const q = gh.json?.data?.fetchChallengePage;

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
    } else if (gh.status !== 404) {
      console.error("GitHub fetch failed:", (gh as any).message || gh);
    }
  } else {
    console.error(
      "Missing GitHub envs:",
      JSON.stringify({
        hasToken: Boolean(GITHUB_TOKEN),
        hasOwner: Boolean(GITHUB_OWNER),
        hasRepo: Boolean(GITHUB_REPO),
        branch: GITHUB_BRANCH,
      }),
    );
  }

  // Keep a stable canonical URL for previews (can be anything in testing)
  const url = `${siteUrl}/quest/${TEST_QUEST_ID}`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  );

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
  <p><a href="${escapeHtml(url)}">Open page</a></p>
</body>
</html>`;

  res.status(200).send(html);
}
