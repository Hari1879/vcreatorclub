import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FollowerCountResult, FollowerPlatform } from './follower-count.dto';
import { parseYoutubeUrl } from './youtube-url';

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3/channels';
const TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX = 1_000;

type Fetcher = (url: string) => Promise<FollowerCountResult>;

@Injectable()
export class FollowerCountService {
  private readonly cache = new Map<
    string,
    { expires: number; value: FollowerCountResult }
  >();
  // Add new platforms here.
  private readonly fetchers: Record<FollowerPlatform, Fetcher> = {
    youtube: (url) => this.youtube(url),
  };

  constructor(private readonly config: ConfigService) {}

  async getCount(platform: string, url: string): Promise<FollowerCountResult> {
    const fetcher = (this.fetchers as Record<string, Fetcher | undefined>)[
      platform
    ];
    if (!fetcher) throw new BadRequestException('Unsupported platform');
    return fetcher(url);
  }

  private async youtube(rawUrl: string): Promise<FollowerCountResult> {
    const ref = parseYoutubeUrl(rawUrl);
    const key = this.config.get<string>('YOUTUBE_API_KEY');
    if (!key) {
      throw new ServiceUnavailableException(
        'YouTube lookups are not configured',
      );
    }

    const cacheKey = `youtube:${ref.kind}:${ref.value.toLowerCase()}`;
    const hit = this.cache.get(cacheKey);
    if (hit && hit.expires > Date.now()) return hit.value;

    const params = new URLSearchParams({ part: 'statistics', key });
    params.set(ref.kind === 'handle' ? 'forHandle' : 'id', ref.value);

    let body: {
      items?: {
        statistics?: {
          hiddenSubscriberCount?: boolean;
          subscriberCount?: string;
        };
      }[];
    };
    try {
      const res = await fetch(`${YOUTUBE_API}?${params.toString()}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      body = await res.json();
    } catch {
      // Deliberately generic: the request URL contains the API key.
      throw new BadGatewayException('Could not fetch subscriber count');
    }

    const stats = body?.items?.[0]?.statistics;
    if (!body?.items?.length) throw new NotFoundException('Channel not found');

    const count = Number(stats?.subscriberCount);
    const value: FollowerCountResult =
      stats?.hiddenSubscriberCount || !Number.isFinite(count)
        ? { count: null, hidden: true }
        : { count, hidden: false };

    if (this.cache.size >= CACHE_MAX) {
      this.cache.delete(this.cache.keys().next().value as string);
    }
    this.cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, value });
    return value;
  }
}
