import { BadRequestException } from '@nestjs/common';

export type YoutubeChannelRef =
  { kind: 'handle'; value: string } | { kind: 'id'; value: string };

const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
]);
const UNSUPPORTED = 'Unsupported YouTube URL, use an @handle or /channel/ link';

/**
 * Extracts a channel identifier from a YouTube URL. The URL itself is never
 * fetched; only the extracted identifier is sent to the official API.
 */
export function parseYoutubeUrl(raw: string): YoutubeChannelRef {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException('Invalid URL');
  }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
    throw new BadRequestException('URL must be an https youtube.com link');
  }
  if (url.username || url.password || url.port) {
    throw new BadRequestException('URL must be an https youtube.com link');
  }

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length === 1) {
    let seg: string;
    try {
      seg = decodeURIComponent(parts[0]);
    } catch {
      throw new BadRequestException(UNSUPPORTED);
    }
    if (/^@[A-Za-z0-9._-]{1,100}$/.test(seg)) {
      return { kind: 'handle', value: seg };
    }
  } else if (parts.length === 2 && parts[0] === 'channel') {
    if (/^UC[A-Za-z0-9_-]{22}$/.test(parts[1])) {
      return { kind: 'id', value: parts[1] };
    }
  }
  throw new BadRequestException(UNSUPPORTED);
}
