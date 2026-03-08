import { genericUserAgent, env } from "../../config.js";
import { getCookie, updateCookie } from "../cookie/manager.js";

// Helper function to add delay between requests
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Fetch using FlareSolverr proxy to bypass Cloudflare
const fetchWithFlareSolverr = async (url) => {
  const flareSolverrURL = env.flareSolverrURL;
  if (!flareSolverrURL) {
    return null;
  }

  console.log('[sora] using FlareSolverr at:', flareSolverrURL);

  try {
    const response = await fetch(`${flareSolverrURL}/v1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cmd: 'request.get',
        url: url,
        maxTimeout: 60000,
        // Wait for React to hydrate and render the video element
        wait: 5000,
      }),
    });

    const data = await response.json();

    if (data.status === 'ok' && data.solution) {
      console.log('[sora] FlareSolverr success, status:', data.solution.status);
      return {
        ok: data.solution.status >= 200 && data.solution.status < 300,
        status: data.solution.status,
        text: async () => data.solution.response,
        headers: new Headers(),
      };
    } else {
      console.log('[sora] FlareSolverr failed:', data.message);
      return null;
    }
  } catch (error) {
    console.error('[sora] FlareSolverr error:', error.message);
    return null;
  }
};

// Direct fetch with cookies
const fetchDirect = async (url, cookie) => {
  const response = await fetch(url, {
    headers: {
      "user-agent": genericUserAgent,
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
      "accept-encoding": "gzip, deflate, br, zstd",
      "cache-control": "no-cache",
      "pragma": "no-cache",
      "sec-ch-ua": '"Not(A:Brand";v="8", "Chromium";v="144"',
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

  return response;
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

  let res;

  // Try FlareSolverr first if configured
  if (env.flareSolverrURL) {
    res = await fetchWithFlareSolverr(targetUrl);
  }

  // Fall back to direct fetch with cookies
  if (!res || !res.ok) {
    console.log('[sora] trying direct fetch with cookies');
    console.log('[sora] cookie loaded:', cookie ? 'yes' : 'no');
    res = await fetchDirect(targetUrl, cookie);
    console.log('[sora] direct fetch status:', res.status);
    updateCookie(cookie, res.headers);
  }

  if (!res.ok) {
    return { error: "fetch.fail" };
  }

  const html = await res.text();
  console.log('[sora] HTML length:', html.length);
  
  // Debug: check if videos.openai.com exists in HTML at all
  const hasVideosDomain = html.includes('videos.openai.com');
  console.log('[sora] contains videos.openai.com:', hasVideosDomain);
  
  // Check for common patterns
  console.log('[sora] contains __NEXT_DATA__:', html.includes('__NEXT_DATA__'));
  console.log('[sora] contains video tag:', html.includes('<video'));
  console.log('[sora] contains openai.com:', html.includes('openai.com'));
  
  // Log the title to see what page we got
  const pageTitleMatch = html.match(/<title>([^<]+)<\/title>/i);
  console.log('[sora] page title:', pageTitleMatch?.[1] || 'no title');
  
  // Log first 500 chars of body to see what we're getting
  const bodyStart = html.indexOf('<body');
  if (bodyStart > -1) {
    console.log('[sora] body preview:', html.substring(bodyStart, bodyStart + 500));
  }
  
  if (hasVideosDomain) {
    // Log a snippet around the first occurrence
    const idx = html.indexOf('videos.openai.com');
    console.log('[sora] context around video URL:', html.substring(Math.max(0, idx - 20), idx + 100));
  }

  // Extract video URL from og:video meta tag
  let videoUrl;
  let title;

  // Try to extract from __NEXT_DATA__ JSON (Next.js embeds data here)
  const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/i);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      console.log('[sora] found __NEXT_DATA__, searching for video URL');
      // Search recursively for videos.openai.com URL
      const findVideoUrl = (obj) => {
        if (typeof obj === 'string' && obj.includes('videos.openai.com')) {
          return obj;
        }
        if (typeof obj === 'object' && obj !== null) {
          for (const value of Object.values(obj)) {
            const found = findVideoUrl(value);
            if (found) return found;
          }
        }
        return null;
      };
      videoUrl = findVideoUrl(nextData);
      if (videoUrl) console.log('[sora] found video URL in __NEXT_DATA__');
    } catch (e) {
      console.log('[sora] failed to parse __NEXT_DATA__:', e.message);
    }
  }

  // Try og:video meta tag
  if (!videoUrl) {
    const ogVideoMatch = html.match(
      /<meta\s+property=["']og:video["']\s+content=["']([^"']+)["']/i,
    );
    if (ogVideoMatch) {
      videoUrl = ogVideoMatch[1];
      console.log('[sora] found og:video URL');
      if (videoUrl.includes('&')) {
        videoUrl = videoUrl
          .replace(/&quot;/g, '"')
          .replace(/&#x27;/g, "'")
          .replace(/&#39;/g, "'")
          // Do &amp; last to avoid double-decoding
          .replace(/&amp;/g, "&");
      }
    }
  }

  // Fallback: search for video URLs in HTML if og:video not found
  if (!videoUrl) {
    console.log('[sora] og:video not found, trying fallback patterns');
    
    // First, try to get from data-detail-view-assigned-src (main video player)
    const detailViewMatch = html.match(/data-detail-view-assigned-src=["']([^"']+videos\.openai\.com[^"']+)["']/i);
    if (detailViewMatch) {
      videoUrl = detailViewMatch[1];
      console.log('[sora] found video via data-detail-view-assigned-src');
    }
    
    // Try to extract from <video> tag src attribute (not poster which is the thumbnail)
    if (!videoUrl) {
      // Match src= that comes AFTER the video tag opening, avoiding poster=
      const videoTagMatch = html.match(/<video[^>]+?\ssrc=["']([^"']+videos\.openai\.com[^"']+)["']/i);
      if (videoTagMatch) {
        videoUrl = videoTagMatch[1];
        console.log('[sora] found video tag src');
      }
    }
    
    // Last resort: find src= attributes with videos.openai.com URLs
    if (!videoUrl) {
      // Only match src= attributes, not poster=
      const srcMatches = html.matchAll(/\ssrc=["'](https:\/\/videos\.openai\.com\/[^"']+)["']/gi);
      for (const match of srcMatches) {
        videoUrl = match[1];
        console.log('[sora] found video URL via src attribute');
        break;
      }
    }
    
    // Ultimate fallback: any videos.openai.com URL
    if (!videoUrl) {
      const anyMatch = html.match(/https:\/\/videos\.openai\.com\/[^"'\s<>]+/i);
      if (anyMatch) {
        videoUrl = anyMatch[0];
        console.log('[sora] found video URL via any pattern');
      }
    }
  }

  // Extract title from HTML title tag
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    title = titleMatch[1].replace(" - Sora", "").replace(" | Sora", "").trim();
  }

  if (!videoUrl) {
    console.log('[sora] no video URL found');
    return { error: "fetch.empty" };
  }

  console.log('[sora] raw video URL:', videoUrl.substring(0, 100) + '...');

  // Decode HTML entities only (don't touch URL encoding like %2F)
  videoUrl = videoUrl
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");

  // Clean up the video URL - decode unicode escapes (\u0026 -> &)
  videoUrl = videoUrl.replace(/\\u([\dA-Fa-f]{4})/g, (_, hex) => 
    String.fromCharCode(parseInt(hex, 16))
  );

  // Ensure it starts with https://
  if (!videoUrl.startsWith('https://')) {
    videoUrl = 'https://' + videoUrl;
  }

  console.log('[sora] final video URL:', videoUrl);

  const cleanId = postId.replace(/[^a-zA-Z0-9_-]/g, "");
  const cleanTitle = title?.replace(/[^\w\s-]/g, '').trim() || `Sora Video`;

  return {
    urls: videoUrl,
    filenameAttributes: {
      service: 'sora',
      id: cleanId,
      title: cleanTitle,
      extension: 'mp4'
    },
    fileMetadata: {
      title: title || `Sora Video ${cleanId}`,
    },
  };
}