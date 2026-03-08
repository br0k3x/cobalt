import { genericUserAgent, env } from "../../config.js";
import { getCookie, updateCookie } from "../cookie/manager.js";

const fetchWithFlareSolverr = async (url) => {
  const flareSolverrURL = env.flareSolverrURL;
  if (!flareSolverrURL) {
    return null;
  }

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
        wait: 10000,
      }),
    });

    const data = await response.json();

    if (data.status === 'ok' && data.solution) {
      return {
        ok: data.solution.status >= 200 && data.solution.status < 300,
        status: data.solution.status,
        text: async () => data.solution.response,
        headers: new Headers(),
      };
    }
    return null;
  } catch {
    return null;
  }
};

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
  if (!obj.postId) {
    return { error: "fetch.empty" };
  }

  try {
    return await handlePostUrl(obj.postId);
  } catch {
    return { error: "fetch.fail" };
  }
}

async function handlePostUrl(postId) {
  const targetUrl = `https://sora.chatgpt.com/p/${postId}`;
  const cookie = getCookie('sora');

  let res;

  if (env.flareSolverrURL) {
    res = await fetchWithFlareSolverr(targetUrl);
  }

  if (!res || !res.ok) {
    res = await fetchDirect(targetUrl, cookie);
    updateCookie(cookie, res.headers);
  }

  if (!res.ok) {
    return { error: "fetch.fail" };
  }

  const html = await res.text();

  let videoUrl;
  let title;

  const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/i);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
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
    } catch {
      // ignore parse errors
    }
  }

  // Try og:video meta tag
  if (!videoUrl) {
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
          .replace(/&amp;/g, "&");
      }
    }
  }

  if (!videoUrl) {
    const detailViewMatch = html.match(/data-detail-view-assigned-src=["']([^"']+videos\.openai\.com[^"']+)["']/i);
    if (detailViewMatch) {
      videoUrl = detailViewMatch[1];
    }
    
    if (!videoUrl) {
      const videoTagMatch = html.match(/<video[^>]+?\ssrc=["']([^"']+videos\.openai\.com[^"']+)["']/i);
      if (videoTagMatch) {
        videoUrl = videoTagMatch[1];
      }
    }
    
    if (!videoUrl) {
      const srcMatches = html.matchAll(/\ssrc=["'](https:\/\/videos\.openai\.com\/[^"']+)["']/gi);
      for (const match of srcMatches) {
        videoUrl = match[1];
        break;
      }
    }
    
    if (!videoUrl) {
      const allMatches = html.matchAll(/https:\/\/videos\.openai\.com\/[^"'\s<>]+/gi);
      for (const match of allMatches) {
        const url = match[0];
        if (url.includes('%2Fthumbnail%2F') || url.includes('/thumbnail/') ||
            url.includes('%2Fdrvs%2F') || url.includes('/drvs/')) {
          continue;
        }
        videoUrl = url;
        break;
      }
    }
  }

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    title = titleMatch[1].replace(" - Sora", "").replace(" | Sora", "").trim();
  }

  if (!videoUrl) {
    return { error: "fetch.empty" };
  }

  videoUrl = videoUrl
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");

  videoUrl = videoUrl.replace(/\\u([\dA-Fa-f]{4})/g, (_, hex) => 
    String.fromCharCode(parseInt(hex, 16))
  );

  videoUrl = videoUrl.replace(/[\\]+$/, '').trim();

  if (!videoUrl.startsWith('https://')) {
    videoUrl = 'https://' + videoUrl;
  }

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