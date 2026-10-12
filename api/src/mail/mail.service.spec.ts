import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

const mail = {
  to: 'a@x.com',
  subject: 's',
  html: '<p>h</p>',
  text: 't',
  template: 'test',
};

function make(env: Record<string, string>) {
  const queries: unknown[][] = [];
  const db: any = {
    one: jest.fn(async (_s: string, p: unknown[]) => {
      queries.push(p);
      return { id: 'log-1' };
    }),
    query: jest.fn(async () => []),
  };
  const config = { get: (k: string) => env[k] } as unknown as ConfigService;
  return { svc: new MailService(db, config), db };
}

describe('MailService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('skips (no fetch) when RESEND_API_KEY is empty', async () => {
    const spy = jest.spyOn(global, 'fetch' as any);
    const { svc, db } = make({ RESEND_API_KEY: '' });
    await expect(svc.send(mail)).resolves.toEqual({ status: 'skipped' });
    expect(spy).not.toHaveBeenCalled();
    expect(db.one.mock.calls[0][1][4]).toBe('skipped');
  });

  it('never throws when the provider fails', async () => {
    jest.spyOn(global, 'fetch' as any).mockRejectedValue(new Error('boom'));
    const { svc } = make({ RESEND_API_KEY: 're_x', MAIL_SPACING_MS: '1' });
    await expect(svc.send(mail)).resolves.toEqual({ status: 'failed' });
  });

  it('sends one at a time, spaced apart', async () => {
    const starts: number[] = [];
    jest.spyOn(global, 'fetch' as any).mockImplementation((async () => {
      starts.push(Date.now());
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ id: 'p1' }),
      };
    }) as any);
    const { svc } = make({ RESEND_API_KEY: 're_x', MAIL_SPACING_MS: '80' });
    const res = await Promise.all([
      svc.send(mail),
      svc.send(mail),
      svc.send(mail),
    ]);
    expect(res.map((r) => r.status)).toEqual(['sent', 'sent', 'sent']);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(70);
    expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(70);
  });

  it('uses the batch endpoint above 10 recipients, in chunks of 100', async () => {
    const urls: string[] = [];
    jest.spyOn(global, 'fetch' as any).mockImplementation((async (
      url: string,
      init: any,
    ) => {
      urls.push(url);
      const n = JSON.parse(init.body).length;
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          data: Array.from({ length: n }, (_, i) => ({ id: `id${i}` })),
        }),
      };
    }) as any);
    const { svc } = make({ RESEND_API_KEY: 're_x', MAIL_SPACING_MS: '1' });
    await svc.sendBulk(
      Array.from({ length: 150 }, (_, i) => ({ ...mail, to: `u${i}@x.com` })),
    );
    expect(urls).toEqual([
      'https://api.resend.com/emails/batch',
      'https://api.resend.com/emails/batch',
    ]);
  });
});
