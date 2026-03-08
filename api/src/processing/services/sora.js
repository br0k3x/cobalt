import { genericUserAgent } from "../../config.js";
import { getCookie, updateCookie } from "../cookie/manager.js";

// Helper function to add delay between requests
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper function to check if response is a Cloudflare challenge
const isCloudflareChallenge = (response) => {
  return (
    response.status === 403 ||
    response.status === 503 ||
    (response.status === 200 &&
      response.headers.get("server")?.includes("cloudflare"))
  );
};

// Enhanced fetch with retry logic for Cloudflare challenges
const fetchWithRetry = async (url, options, maxRetries = 3) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // If it's a Cloudflare challenge and not the last attempt, wait and retry
      if (isCloudflareChallenge(response) && attempt < maxRetries) {
        await delay(1000 * attempt); // Exponential backoff
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await delay(1000 * attempt);
        continue;
      }
      throw error;
    }
  }

  throw lastError;
};

export default async function (obj) {
  let videoId = obj.postId;
  if (!videoId) {
    return { error: "fetch.empty" };
  }

  try {
    // For /p/ (post) URLs, use HTML parsing
    if (obj.postId) {
      return await handlePostUrl(obj.postId, obj);
    }

    return { error: "fetch.empty" };
  } catch (error) {
    console.error("Sora service error:", error);
    return { error: "fetch.fail" };
  }
}

async function handlePostUrl(postId, obj) {
  const targetUrl = `https://sora.chatgpt.com/p/${postId}`;
  const cookie = getCookie('sora');

  console.log('[sora] cookie loaded:', cookie ? 'yes' : 'no');
  if (cookie) console.log('[sora] cookie preview:', cookie.toString().substring(0, 50) + '...');

  const res = await fetchWithRetry(targetUrl, {
    headers: {
      // if you have a cookie configured, change the UA to your browser's UA.
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 OPR/128.0.0.0",
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
      "accept-encoding": "gzip, deflate, br, zstd",
      "cache-control": "no-cache",
      "pragma": "no-cache",
      "sec-ch-ua":
        '"Not(A:Brand";v="8", "Chromium";v="144", "Opera GX";v="128"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1",
      cookie: cookie?.toString(),
    },
  });

  console.log('[sora] response status:', res.status);

  updateCookie(cookie, res.headers);

  if (!res.ok) {
    return { error: "fetch.fail" };
  }

  const html = await res.text();

  // Extract video URL from og:video meta tag
  let videoUrl;
  let title;

  const ogVideoMatch = html.match(
    /<meta\s+property=["']og:video["']\s+content=["']([^"']+)["']/i,
  );
  if (ogVideoMatch) {
    videoUrl = ogVideoMatch[1];
    if (videoUrl.includes('&')) {
      videoUrl = videoUrl
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'")
        // Do &amp; last to avoid double-decoding
        .replace(/&amp;/g, "&");
    }
  }

  // Fallback: search for video URLs in HTML if og:video not found
  if (!videoUrl) {
    const videoPatterns = [
      // Match URLs with various path structures (az/vg-assets, vg-assets, etc.)
      /(https:\/\/videos\.openai\.com\/[^"'>\s\\]+\.mp4[^"'>\s]*)/g,
      /"(https:\/\/videos\.openai\.com\/[^"]+\.mp4[^"]*)"/g,
      /'(https:\/\/videos\.openai\.com\/[^']+\.mp4[^']*)'/g,
    ];

    for (const pattern of videoPatterns) {
      const match = html.match(pattern);
      if (match) {
        videoUrl = match[0].replace(/^["']|["']$/g, ""); // Remove quotes
        break;
      }
    }
  }

  // Extract title from HTML title tag
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    title = titleMatch[1].replace(" - Sora", "").replace(" | Sora", "").trim();
  }

  // Decode HTML entities if present (only for fallback URLs that weren't already decoded)
  if (videoUrl && !ogVideoMatch) {
    videoUrl = videoUrl.replace(/&amp;/g, "&");
  }

  if (!videoUrl) {
    return { error: "fetch.empty" };
  }

  // Generate filename
  const cleanId = postId.replace(/[^a-zA-Z0-9_-]/g, "");
  const videoFilename = `sora_${cleanId}.mp4`;

  return {
    type: "proxy",
    urls: videoUrl,
    filename: videoFilename,
    fileMetadata: {
      title: title || `Sora Video ${cleanId}`,
    },
  };
}