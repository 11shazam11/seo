import type { VercelRequest, VercelResponse } from "@vercel/node";

// Tiny HTML escape so meta tags don’t break
function esc(s: any) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ✅ This is the simple working fetch logic (same idea as your Windmill snippet)
async function fetchQuestFromGitHub(id: number) {
  const owner = process.env.GITHUB_OWNER!;
  const repo = process.env.GITHUB_REPO!;
  const ref = process.env.GITHUB_BRANCH || "main";
  const token = process.env.GITHUB_TOKEN!;
  if (token) {
    console.log(`token there : ${token}`);
  } else {
    console.log("token not therer");
  }
  const path = `public/quests/${id}.json`;
  const url =
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}` +
    `?ref=${encodeURIComponent(ref)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.raw+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "vercel-og",
    },
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(
      `GitHub fetch failed: ${res.status} ${res.statusText} ${msg.slice(0, 150)}`,
    );
  }

  return res.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const siteUrl = (
    process.env.SITE_URL || "https://seo-sbma.vercel.app"
  ).replace(/\/+$/, "");

  // Get quest id from query (?id=100001582). Fallback for testing.
  const id = Number(req.query.id ?? 100001582);

  let title = "My App";
  let description = "My app description";
  let image = `${siteUrl}/og-default.png`;

  try {
    const data = await fetchQuestFromGitHub(id);
    const q = data?.data?.fetchChallengePage;

    if (q) {
      title = q.title || title;
      description = q.summary || description;

      // coverImg can be "" in your sample. Keep default if empty.
      if (q.coverImg) {
        image = /^https?:\/\//i.test(q.coverImg)
          ? q.coverImg
          : `${siteUrl}${q.coverImg.startsWith("/") ? "" : "/"}${q.coverImg}`;
      }
    }
  } catch (e: any) {
    // Keep fallback OG tags but log the real reason in Vercel logs
    console.error("OG fetch error:", e?.message || e);
  }

  const canonicalUrl = `${siteUrl}/quest/${id}`;

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />

  <meta property="og:type" content="website" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(canonicalUrl)}" />
  <meta property="og:image" content="${esc(image)}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${esc(image)}" />
</head>
<body>
  <h1>${esc(title)}</h1>
  <p>${esc(description)}</p>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
