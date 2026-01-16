import type { VercelRequest, VercelResponse } from "@vercel/node";

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeSiteUrl(raw: string) {
  // remove trailing slashes so `${siteUrl}/file.png` is always correct
  return raw.replace(/\/+$/, "");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // IMPORTANT: for OG tags, images should be absolute URLs
  const siteUrl = normalizeSiteUrl(
    process.env.SITE_URL || "https://seo-sbma.vercel.app"
  );

  // Example: /quest1 or /quest2 (coming from your rewrite into ?path=...)
  const path = String(req.query.path ?? "/");

  let title = "";
  let description = "";
  let image = "";

  // ✅ Use images from /public as: https://domain.com/<filename>
  // Put these files in your React /public folder:
  // - public/q1.png
  // - public/q2.png
  // - public/og-default.png
  if (path === "/quest12") {
    title = "ONE PIECE";
    description = "Finding the one pieace and be the pirate king";
    image = `${siteUrl}/q1.png`;
  } else if (path === "/quest22") {
    title = "VALORANT";
    description = "A free to play game fps shooter game";
    image = `${siteUrl}/q2.png`;
  } else {
    title = "My App";
    description = "My app description";
    image = `${siteUrl}/og-default.png`;
  }

  // ✅ canonical URL (avoid the old slice(1) bug)
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
