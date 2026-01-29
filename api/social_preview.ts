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

function redactToken(tok: string) {
  if (!tok) return "";
  const t = String(tok);
  if (t.length <= 8) return "****";
  return `${t.slice(0, 3)}…${t.slice(-3)} (len=${t.length})`;
}

function extractDigits(s: string): number | null {
  const m = String(s || "").match(/(\d{3,})/); // 3+ digits to avoid tiny matches
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function getQuestId(req: VercelRequest): number | null {
  // Prefer rewrite param: /quest/:id -> /api/social_preview?id=:id&path=/quest/:id
  const qid = req.query?.id;
  if (typeof qid === "string") {
    const n = Number(qid);
    if (Number.isFinite(n) && n > 0) return n;
  }
  if (Array.isArray(qid) && qid[0]) {
    const n = Number(qid[0]);
    if (Number.isFinite(n) && n > 0) return n;
  }

  // Fallback: ?path=/quest/100001577
  const qpath = req.query?.path;
  if (typeof qpath === "string") return extractDigits(qpath);
  if (Array.isArray(qpath) && qpath[0]) return extractDigits(qpath[0]);

  // Last fallback: req.url
  return extractDigits(String(req.url || ""));
}

async function readGitHubErrorBody(res: Response) {
  const ct = res.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const j: any = await res.json();
      return {
        message: j?.message ?? "",
        documentation_url: j?.documentation_url ?? "",
      };
    }
    const txt = await res.text();
    return { message: txt.slice(0, 300), documentation_url: "" };
  } catch {
    return { message: "", documentation_url: "" };
  }
}

function classifyGitHubAuthIssue(status: number, ghMessage: string) {
  const msg = (ghMessage || "").toLowerCase();

  if (status === 401) {
    // Typical: "Bad credentials"
    return "GitHub 401 Unauthorized: token is missing/invalid/expired (common message: Bad credentials).";
  }
  if (status === 403) {
    if (msg.includes("rate limit")) {
      return "GitHub 403 Forbidden: rate limit hit (token may be missing or too many requests).";
    }
    if (msg.includes("resource not accessible")) {
      return "GitHub 403 Forbidden: token does not have access to this repo/resource.";
    }
    return "GitHub 403 Forbidden: access blocked (permissions, SSO, fine-grained token scope, or rate limits).";
  }
  return "";
}

async function fetchQuestJsonRaw(opts: {
  owner: string;
  repo: string;
  ref: string;
  path: string; // public/quests/<id>.json
  token: string;
}) {
  const { owner, repo, ref, path, token } = opts;

  // NOTE: GitHub "contents" endpoint expects path segments, not URL-encoded slashes.
  // We should encode each segment, not the entire path.
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");

  const apiUrl =
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}` +
    `?ref=${encodeURIComponent(ref)}`;

  const res = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.raw+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "vercel-social-preview",
    },
  });

  if (!res.ok) {
    const err = await readGitHubErrorBody(res);
    const hint = classifyGitHubAuthIssue(res.status, err.message);

    return {
      ok: false as const,
      status: res.status,
      statusText: res.statusText,
      apiUrl,
      ghMessage: err.message || "",
      ghDocs: err.documentation_url || "",
      hint,
    };
  }

  const json = await res.json();
  return { ok: true as const, json, apiUrl };
}

function sendHtml(res: VercelResponse, html: string) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // while debugging, keep no-cache
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, max-age=0",
  );
  res.status(200).send(html);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const siteUrl = normalizeSiteUrl(
    process.env.SITE_URL || "https://seo-sbma.vercel.app",
  );

  const questId = getQuestId(req) ?? 100001577;
  const publicPath = `/quest/${questId}`;
  const canonicalUrl = `${siteUrl}${publicPath}`;

  // Env
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
  const GITHUB_OWNER = process.env.GITHUB_OWNER || "";
  const GITHUB_REPO = process.env.GITHUB_REPO || "";
  const GITHUB_REF = process.env.GITHUB_BRANCH || "main";

  // Defaults for tags
  let title = "My App";
  let description = "My app description";
  let image = `${siteUrl}/og-default.png`;

  const debug: Record<string, any> = {
    questId,
    canonicalUrl,
    incoming: {
      method: req.method,
      url: req.url,
      query: req.query,
      ua: req.headers["user-agent"],
    },
    githubEnv: {
      hasToken: Boolean(GITHUB_TOKEN),
      token: redactToken(GITHUB_TOKEN),
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      ref: GITHUB_REF,
    },
  };

  // Hard failure if missing envs
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    const msg =
      "Missing GitHub env vars. Required: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO. (GITHUB_BRANCH optional)";
    console.error(msg, debug.githubEnv);

    const html = `<!doctype html>
<html><head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
</head><body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <pre>${escapeHtml(msg)}</pre>
  <pre>${escapeHtml(JSON.stringify(debug.githubEnv, null, 2))}</pre>
</body></html>`;
    return sendHtml(res, html);
  }

  // Fetch quest file
  const filePath = `public/quests/${questId}.json`;
  const gh = await fetchQuestJsonRaw({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    ref: GITHUB_REF,
    path: filePath,
    token: GITHUB_TOKEN,
  });

  if (gh.ok) {
    // Adjust this based on your JSON shape.
    // You currently expect: gh.json?.data?.fetchChallengePage
    const q =
      gh.json?.data?.fetchChallengePage ??
      gh.json?.data?.fetchChallengeForSeo ??
      gh.json;

    if (q) {
      title = String(q.title ?? title);
      description = String(q.summary ?? q.description ?? description);

      const img = q.coverImg ?? q.image;
      if (img) {
        const s = String(img).trim();
        if (s) {
          image = /^https?:\/\//i.test(s)
            ? s
            : `${siteUrl}${s.startsWith("/") ? s : `/${s}`}`;
        }
      }
    }

    console.log("GitHub fetch OK", {
      questId,
      filePath,
      apiUrl: gh.apiUrl,
      resolvedTitle: title,
    });
  } else {
    // ✅ Proper, readable error logs for 401 etc.
    console.error("GitHub fetch FAILED", {
      questId,
      filePath,
      apiUrl: gh.apiUrl,
      status: gh.status,
      statusText: gh.statusText,
      ghMessage: gh.ghMessage,
      hint: gh.hint,
      docs: gh.ghDocs,
      token: redactToken(GITHUB_TOKEN),
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      ref: GITHUB_REF,
    });

    // Also include a lightweight debug note in the HTML
    debug.githubError = {
      status: gh.status,
      statusText: gh.statusText,
      ghMessage: gh.ghMessage,
      hint: gh.hint,
      docs: gh.ghDocs,
      apiUrl: gh.apiUrl,
      filePath,
    };
  }

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

  <!-- debug: ${escapeHtml(JSON.stringify(debug.githubError ?? {}, null, 0))} -->
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
</body>
</html>`;

  return sendHtml(res, html);
}
