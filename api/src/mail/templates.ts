export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const NAVY = '#0D1B3E';
const BLUE = '#1E88E5';

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function appUrl(): string {
  return (process.env.APP_URL || 'https://vcreatorclub.in').replace(/\/+$/, '');
}

/** Subjects are plain text headers: no line breaks allowed. */
function subjectLine(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').trim();
}

interface Layout {
  subject: string;
  heading: string;
  paragraphs: string[];
  button?: { label: string; url: string };
}

function render(l: Layout): EmailContent {
  const prefs = `${appUrl()}/dashboard/profile`;
  const paragraphsHtml = l.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:#1F2937;">${escapeHtml(p).replace(/\r?\n/g, '<br>')}</p>`,
    )
    .join('');
  const buttonHtml = l.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 8px 0;"><tr><td align="center" bgcolor="${BLUE}" style="border-radius:6px;"><a href="${escapeHtml(l.button.url)}" style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;border-radius:6px;">${escapeHtml(l.button.label)}</a></td></tr></table>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(l.subject)}</title></head>
<body style="margin:0;padding:0;background-color:#F3F4F6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4F6;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;font-family:Arial,Helvetica,sans-serif;">
<tr><td style="background-color:${NAVY};padding:20px 28px;border-radius:8px 8px 0 0;font-size:16px;font-weight:bold;letter-spacing:2px;color:#FFFFFF;">VCC &middot; CREATOR CLUB</td></tr>
<tr><td style="background-color:#FFFFFF;padding:28px;">
<h1 style="margin:0 0 16px 0;font-size:20px;line-height:28px;color:${NAVY};">${escapeHtml(l.heading)}</h1>
${paragraphsHtml}${buttonHtml}
</td></tr>
<tr><td style="background-color:#F9FAFB;padding:20px 28px;border-radius:0 0 8px 8px;border-top:1px solid #E5E7EB;font-size:12px;line-height:18px;color:#6B7280;">
<p style="margin:0 0 8px 0;">A Creator Initiative by FTPL &middot; Tamil Nadu</p>
<p style="margin:0 0 8px 0;">Benefits are directional and subject to program terms. No commitments or assurances are made by FTPL or Vivo India.</p>
<p style="margin:0;">Manage email preferences: <a href="${escapeHtml(prefs)}" style="color:${BLUE};">${escapeHtml(prefs)}</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  const text = [
    'VCC · CREATOR CLUB',
    '',
    l.heading,
    '',
    ...l.paragraphs.flatMap((p) => [p, '']),
    ...(l.button ? [`${l.button.label}: ${l.button.url}`, ''] : []),
    '--',
    'A Creator Initiative by FTPL · Tamil Nadu',
    'Benefits are directional and subject to program terms. No commitments or assurances are made by FTPL or Vivo India.',
    `Manage email preferences: ${prefs}`,
  ].join('\n');

  return { subject: subjectLine(l.subject), html, text };
}

export function enrollmentReceived(name: string): EmailContent {
  return render({
    subject: "We've received your VCC enrollment",
    heading: 'Thanks for enrolling',
    paragraphs: [
      `Hi ${name},`,
      'We have received your enrollment for Vivo Creator Club. Our team is reviewing your profile and we will email you once there is an update.',
    ],
  });
}

export function approved(name: string): EmailContent {
  return render({
    subject: "Welcome to Vivo Creator Club — you're approved",
    heading: 'Welcome to Vivo Creator Club',
    paragraphs: [
      `Hi ${name},`,
      'Your application has been approved. Your dashboard is ready, where you can review open campaigns and keep your profile up to date.',
      'Eligible creators are given priority consideration for upcoming campaigns, subject to program terms.',
    ],
    button: { label: 'Open my dashboard', url: `${appUrl()}/dashboard` },
  });
}

export function rejected(name: string, note?: string | null): EmailContent {
  const paragraphs = [
    `Hi ${name},`,
    'Thank you for your interest in Vivo Creator Club and for the time you put into your application. After review, we are unable to approve it at this time.',
  ];
  if (note && note.trim())
    paragraphs.push(`Note from the team: ${note.trim()}`);
  paragraphs.push(
    'We appreciate your interest and encourage you to keep creating.',
  );
  return render({
    subject: 'Update on your VCC application',
    heading: 'An update on your application',
    paragraphs,
  });
}

export function tierChanged(name: string, tierLabel: string): EmailContent {
  return render({
    subject: 'Your VCC tier has been updated',
    heading: 'Your tier has been updated',
    paragraphs: [`Hi ${name},`, `Your VCC tier is now ${tierLabel}.`],
    button: { label: 'Open my dashboard', url: `${appUrl()}/dashboard` },
  });
}

function formatDeadline(deadline: string | Date): string {
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return String(deadline);
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(d);
}

export function campaignOpened(
  name: string,
  title: string,
  product?: string | null,
  deadline?: string | Date | null,
): EmailContent {
  const paragraphs = [
    `Hi ${name},`,
    `A new campaign is now open: ${title}${product ? ` (${product})` : ''}.`,
  ];
  if (deadline) paragraphs.push(`Deadline: ${formatDeadline(deadline)}`);
  paragraphs.push(
    'Open the Campaigns tab to view the details and express your interest.',
  );
  return render({
    subject: `New campaign: ${title}`,
    heading: 'A new campaign is open',
    paragraphs,
    button: { label: 'View campaigns', url: `${appUrl()}/dashboard/campaigns` },
  });
}

export function assignmentUpdate(
  name: string,
  campaignTitle: string,
  status: string,
): EmailContent {
  const lines: Record<string, string> = {
    accepted: `You have been selected for "${campaignTitle}". The VCC team will reach out with next steps.`,
    declined: `Thank you for your interest in "${campaignTitle}". You were not selected this time, and we hope to see you in future campaigns.`,
    completed: `Your work on "${campaignTitle}" has been marked complete. Thank you!`,
    cancelled: `Your participation in "${campaignTitle}" has been cancelled.`,
  };
  return render({
    subject: `Campaign update: ${campaignTitle}`,
    heading: 'Campaign update',
    paragraphs: [
      `Hi ${name},`,
      lines[status] ?? `The status of "${campaignTitle}" is now ${status}.`,
    ],
    button: { label: 'View campaigns', url: `${appUrl()}/dashboard/campaigns` },
  });
}

export function custom(
  name: string,
  title: string,
  message: string,
): EmailContent {
  return render({
    subject: title,
    heading: title,
    paragraphs: [`Hi ${name},`, message],
    button: { label: 'Open my dashboard', url: `${appUrl()}/dashboard` },
  });
}

export function adminEnrollmentAlert(
  name: string,
  city: string | null | undefined,
  followers: number | string,
  platform: string,
): EmailContent {
  const place = city || 'unknown city';
  return render({
    subject: `New VCC enrollment: ${name} (${place}, ${followers} on ${platform})`,
    heading: 'New VCC enrollment',
    paragraphs: [
      `${name} (${place}, ${followers} on ${platform}) has enrolled and is awaiting review.`,
    ],
    button: { label: 'Review in admin', url: `${appUrl()}/admin` },
  });
}
