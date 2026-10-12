import * as t from './templates';

const BANNED = [
  'guaranteed',
  'assured',
  'committed to',
  'will receive',
  'you will get',
  'exclusive rights',
  'contract',
];

const all = () => [
  t.enrollmentReceived('Asha'),
  t.approved('Asha'),
  t.rejected('Asha'),
  t.rejected('Asha', 'Please add more content samples.'),
  t.tierChanged('Asha', 'Core Creator'),
  t.campaignOpened('Asha', 'Vivo X Launch', 'X300', '2026-12-01T00:00:00Z'),
  t.campaignOpened('Asha', 'Vivo X Launch'),
  ...['accepted', 'declined', 'completed', 'cancelled'].map((s) =>
    t.assignmentUpdate('Asha', 'Vivo X Launch', s),
  ),
  t.custom('Asha', 'Hello', 'A message\nwith two lines'),
  t.adminEnrollmentAlert('Asha', 'Chennai', 12000, 'instagram'),
];

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(t.escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;',
    );
  });
  it('handles null/undefined/numbers', () => {
    expect(t.escapeHtml(null)).toBe('');
    expect(t.escapeHtml(undefined)).toBe('');
    expect(t.escapeHtml(42)).toBe('42');
  });
});

describe('email templates', () => {
  it('contain no banned phrases', () => {
    for (const e of all()) {
      const body = `${e.subject}\n${e.html}\n${e.text}`.toLowerCase();
      for (const phrase of BANNED) expect(body).not.toContain(phrase);
    }
  });

  it('contain no <img> tags and include a text version', () => {
    for (const e of all()) {
      expect(e.html.toLowerCase()).not.toMatch(/<img\b/);
      expect(e.text.length).toBeGreaterThan(20);
    }
  });

  it('escape dynamic values', () => {
    const e = t.custom('<b>Bob</b>', '<i>T</i>', '<script>x</script>');
    expect(e.html).not.toContain('<script>');
    expect(e.html).not.toContain('<b>Bob</b>');
    expect(e.html).toContain('&lt;script&gt;');
    expect(t.rejected('A', '<u>note</u>').html).not.toContain('<u>');
    expect(t.campaignOpened('A', '<x>', '<p>').html).not.toContain('<x>');
  });

  it('use the expected subjects and links', () => {
    process.env.APP_URL = 'https://vcreatorclub.in/';
    expect(t.enrollmentReceived('A').subject).toBe(
      "We've received your VCC enrollment",
    );
    expect(t.approved('A').subject).toBe(
      "Welcome to Vivo Creator Club — you're approved",
    );
    expect(t.approved('A').html).toContain(
      'href="https://vcreatorclub.in/dashboard"',
    );
    expect(t.rejected('A').subject).toBe('Update on your VCC application');
    expect(t.tierChanged('A', 'X').subject).toBe(
      'Your VCC tier has been updated',
    );
    expect(t.campaignOpened('A', 'Foo', 'P').subject).toBe('New campaign: Foo');
    expect(t.campaignOpened('A', 'Foo', 'P').html).toContain(
      'https://vcreatorclub.in/dashboard/campaigns',
    );
    expect(t.approved('A').text).toContain(
      'https://vcreatorclub.in/dashboard/profile',
    );
    delete process.env.APP_URL;
  });
});
