import { env } from "../config.js";

let youtubeClient = null;
let soundcloudClient = null;

async function getYoutubeClient() {
    if (!youtubeClient) {
        const { Client } = await import("youtubei");
        youtubeClient = new Client();
    }
    return youtubeClient;
}

async function getSoundcloudClient() {
    if (!soundcloudClient) {
        const { Soundcloud } = await import("soundcloud.ts");
        soundcloudClient = new Soundcloud();
    }
    return soundcloudClient;
}

function getPlaylistLimit() {
    const maxItems = Number(env.playlistMaxItems);
    return Number.isFinite(maxItems) && maxItems > 0 ? maxItems : 30;
}

const errorMessages = {
    noLink: "you forgot about the link!",
    invalidLink: "that doesn't look like a valid link, are you sure it's the right one?",
    catchedError: "something went wrong, please try again later and if this still keeps happening, report this on github. ",
};

function extractYoutubePlaylistId(urlStr) {
    try {
        const url = new URL(urlStr);
        const list = url.searchParams.get("list");
        return list || null;
    } catch {
        return null;
    }
}

function isSoundcloudPlaylist(urlStr) {
    return /soundcloud\.com\/[a-z0-9-_]+\/sets\/[a-z0-9-_]+/i.test(urlStr);
}

async function getYouTubeVideos(playlistId) {
    const client = await getYoutubeClient();
    const playlist = await client.getPlaylist(playlistId);
    if (!playlist) {
        return { error: errorMessages.invalidLink, status: 400 };
    }

    const videos = playlist.videos;
    if ('next' in videos) {
        await videos.next(0);
    }

    const playlistLimit = getPlaylistLimit();
    if (playlist.videoCount > playlistLimit) {
        return {
            error: `this playlist has ${playlist.videoCount} videos, the limit is ${playlistLimit}`,
            status: 400
        };
    }

    const videoItems = 'items' in videos ? videos.items : videos;
    const urls = videoItems.map((vid) => `https://youtu.be/${vid.id}`);
    return { urls };
}

async function getSoundcloudTracks(playlistUrl) {
    const client = await getSoundcloudClient();
    const playlist = await client.playlists.getAlt(playlistUrl);
    if (!playlist) {
        return { error: errorMessages.invalidLink, status: 400 };
    }

    const playlistLimit = getPlaylistLimit();
    if (playlist.tracks.length > playlistLimit) {
        return {
            error: `this playlist has ${playlist.tracks.length} tracks, the limit is ${playlistLimit}`,
            status: 400
        };
    }

    const urls = playlist.tracks.map((track) => track.permalink_url);
    return { urls };
}

export async function getPlaylistLinks(playlistUrl) {
    try {
        if (!playlistUrl) {
            return { error: errorMessages.noLink, status: 400 };
        }

        const youtubePlaylistId = extractYoutubePlaylistId(playlistUrl);
        const isSoundcloud = isSoundcloudPlaylist(playlistUrl);

        if (youtubePlaylistId) {
            return await getYouTubeVideos(youtubePlaylistId);
        } else if (isSoundcloud) {
            return await getSoundcloudTracks(playlistUrl);
        } else {
            return { error: errorMessages.invalidLink, status: 400 };
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error ?? "unknown");
        return { error: errorMessages.catchedError + message, status: 500 };
    }
}
