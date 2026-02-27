import type { RequestHandler } from "@sveltejs/kit";
import type { Client } from "youtubei";
import type { Soundcloud } from "soundcloud.ts";
import { env } from "$env/dynamic/private";

export const prerender = false;

let youtube: Client | null = null;
let soundcloud: Soundcloud | null = null;

async function getYoutubeClient() {
  if (!youtube) {
    const { Client } = await import("youtubei");
    youtube = new Client();
  }
  return youtube;
}

async function getSoundcloudClient() {
  if (!soundcloud) {
    const { Soundcloud } = await import("soundcloud.ts");
    soundcloud = new Soundcloud();
  }
  return soundcloud;
}

function getPlaylistLimit() {
  const maxItems = Number(env.MAX_ITEMS);
  return Number.isFinite(maxItems) && maxItems > 0 ? maxItems : 30;
}

const errorMessages = {
  noLink: "you forgot about the link!",
  invalidLink:
    "that doesn't look like a valid link, are you sure it's the right one?",
  catchedError:
    "something went wrong, please try again later and if this still keeps happening, report this on github. ",
} as const;

type VideoListResult = string[] | Response;

function errorResponse(message: string, status = 400): Response {
  return new Response(message, { status });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function extractYoutubePlaylistId(urlStr: string): string | null {
  try {
    const url = new URL(urlStr);
    const list = url.searchParams.get("list");
    return list || null;
  } catch {
    return null;
  }
}

function isSoundcloudPlaylist(urlStr: string): boolean {
  return /soundcloud\.com\/[a-z0-9-_]+\/sets\/[a-z0-9-_]+/i.test(urlStr);
}

async function getYouTubeVideos(playlistId: string): Promise<VideoListResult> {
  const client = await getYoutubeClient();
  const playlist = await client.getPlaylist(playlistId);
  if (!playlist) {
    return errorResponse(errorMessages.invalidLink, 400);
  }

  const videos = playlist.videos;
  if ('next' in videos) {
    await videos.next(0);
  }

  const playlistLimit = getPlaylistLimit();
  if (playlist.videoCount > playlistLimit) {
    return errorResponse(
      `this playlist has ${playlist.videoCount} videos, the limit is ${playlistLimit}`,
      400,
    );
  }

  const videoItems = 'items' in videos ? videos.items : videos;
  const urls = videoItems.map((vid: { id: string }) => `https://youtu.be/${vid.id}`);
  return urls;
}

async function getSoundcloudTracks(
  playlistUrl: string,
): Promise<VideoListResult> {
  const client = await getSoundcloudClient();
  const playlist = await client.playlists.getAlt(playlistUrl);
  if (!playlist) {
    return errorResponse(errorMessages.invalidLink, 400);
  }

  const playlistLimit = getPlaylistLimit();
  if (playlist.tracks.length > playlistLimit) {
    return errorResponse(
      `this playlist has ${playlist.tracks.length} tracks, the limit is ${playlistLimit}`,
      400,
    );
  }

  const urls = playlist.tracks.map((track) => track.permalink_url);
  return urls;
}

export const GET: RequestHandler = async ({ url }) => {
  try {
    const playlistUrl = (url.searchParams.get("url") || "").trim();

    if (!playlistUrl) {
      return errorResponse(errorMessages.noLink, 400);
    }

    const youtubePlaylistId = extractYoutubePlaylistId(playlistUrl);
    const isSoundcloud = isSoundcloudPlaylist(playlistUrl);

    let playlistVideos: VideoListResult;

    if (youtubePlaylistId) {
      playlistVideos = await getYouTubeVideos(youtubePlaylistId);
    } else if (isSoundcloud) {
      playlistVideos = await getSoundcloudTracks(playlistUrl);
    } else {
      return errorResponse(errorMessages.invalidLink, 400);
    }

    if (playlistVideos instanceof Response) {
      // Propagate error from helper
      return playlistVideos;
    }

    return jsonResponse(playlistVideos);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? "unknown");
    return errorResponse(errorMessages.catchedError + message, 500);
  }
};