import { BadRequestException } from '@nestjs/common';
import { parseYoutubeUrl } from './youtube-url';

describe('parseYoutubeUrl', () => {
  const id = 'UC' + 'a'.repeat(22);

  it('parses a handle', () => {
    expect(parseYoutubeUrl('https://www.youtube.com/@some.handle')).toEqual({
      kind: 'handle',
      value: '@some.handle',
    });
  });
  it('parses a channel id', () => {
    expect(parseYoutubeUrl(`https://m.youtube.com/channel/${id}`)).toEqual({
      kind: 'id',
      value: id,
    });
  });
  it.each([
    'https://evil.com/@handle',
    'https://youtube.com.evil.com/@handle',
    'http://www.youtube.com/@handle',
    'https://www.youtube.com/c/name',
    'https://www.youtube.com/user/name',
    'https://www.youtube.com/@handle/videos',
    'https://www.youtube.com/watch?v=abc',
    'https://www.youtube.com/channel/short',
    'not a url',
  ])('rejects %s', (u) => {
    expect(() => parseYoutubeUrl(u)).toThrow(BadRequestException);
  });
  it('uses the unsupported-shape message', () => {
    expect(() => parseYoutubeUrl('https://www.youtube.com/c/x')).toThrow(
      'Unsupported YouTube URL, use an @handle or /channel/ link',
    );
  });
});
