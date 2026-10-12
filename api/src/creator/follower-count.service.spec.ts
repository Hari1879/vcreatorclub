import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FollowerCountService } from './follower-count.service';

const mk = (key: string | undefined = 'secret-key') =>
  new FollowerCountService({ get: () => key } as unknown as ConfigService);
const reply = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;
const URL_ = 'https://www.youtube.com/@abc';

describe('FollowerCountService', () => {
  let fetchMock: jest.Mock;
  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('returns the count and calls the official API with forHandle', async () => {
    fetchMock.mockResolvedValue(
      reply({ items: [{ statistics: { subscriberCount: '1234' } }] }),
    );
    await expect(mk().getCount('youtube', URL_)).resolves.toEqual({
      count: 1234,
      hidden: false,
    });
    const called = new URL(fetchMock.mock.calls[0][0]);
    expect(called.origin + called.pathname).toBe(
      'https://www.googleapis.com/youtube/v3/channels',
    );
    expect(called.searchParams.get('forHandle')).toBe('@abc');
    expect(called.searchParams.get('part')).toBe('statistics');
  });

  it('uses id for channel links', async () => {
    fetchMock.mockResolvedValue(
      reply({ items: [{ statistics: { subscriberCount: '1' } }] }),
    );
    const id = 'UC' + 'b'.repeat(22);
    await mk().getCount('youtube', `https://www.youtube.com/channel/${id}`);
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('id')).toBe(id);
  });

  it('reports hidden counts', async () => {
    fetchMock.mockResolvedValue(
      reply({ items: [{ statistics: { hiddenSubscriberCount: true } }] }),
    );
    await expect(mk().getCount('youtube', URL_)).resolves.toEqual({
      count: null,
      hidden: true,
    });
  });

  it('404s on empty items', async () => {
    fetchMock.mockResolvedValue(reply({ items: [] }));
    await expect(mk().getCount('youtube', URL_)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('502s on upstream error/timeout without leaking the key', async () => {
    fetchMock.mockResolvedValue(reply({}, false));
    await expect(mk().getCount('youtube', URL_)).rejects.toThrow(
      BadGatewayException,
    );
    fetchMock.mockRejectedValue(new Error('timeout secret-key'));
    const err = await mk()
      .getCount('youtube', URL_)
      .catch((e: Error) => e);
    expect(err).toBeInstanceOf(BadGatewayException);
    expect(JSON.stringify((err as Error).message)).not.toContain('secret-key');
  });

  it('503s when the key is missing', async () => {
    await expect(mk('').getCount('youtube', URL_)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('400s on unsupported platform', async () => {
    await expect(mk().getCount('tiktok', URL_)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('caches per channel', async () => {
    fetchMock.mockResolvedValue(
      reply({ items: [{ statistics: { subscriberCount: '5' } }] }),
    );
    const s = mk();
    await s.getCount('youtube', URL_);
    await s.getCount('youtube', URL_);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
