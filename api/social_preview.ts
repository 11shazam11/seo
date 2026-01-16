import type { VercelRequest, VercelResponse } from "@vercel/node";

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const imageUrl = 'https://imgs.search.brave.com/Zx_AlxGGgfBiNIt49IApxNwOWsXyzMe6WFxdpph2kg0/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9pbWFn/ZXMuYWxwaGFjb2Rl/cnMuY29tLzEzOS90/aHVtYmJpZy0xMzk0/ODYyLndlYnA'
  // Example: /product/123 or /quest/my-slug
  const path = String(req.query.path ?? "/");
  const siteUrl = process.env.SITE_URL || "https://YOUR_DOMAIN";

  // TODO: Replace this with your real data source:
  // - fetch from your backend
  // - fetch from a public JSON endpoint
  // - read from DB
  const title = path.startsWith("/product/")
    ? `Product page ${path.split("/").pop()}`
    : "My App";

  const description = path.startsWith("/product/")
    ? "Buy this amazing product."
    : "My app description";

  const image = `${siteUrl}/og-default.png`;
  const url = `${siteUrl}${path}`;

  // Cache on Vercel CDN to reduce function hits (seconds)
  // Vercel caching guidance: s-maxage + optional stale-while-revalidate :contentReference[oaicite:0]{index=0}
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");

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
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />

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
