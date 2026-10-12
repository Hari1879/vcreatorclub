import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { mapProfile } from '../common/profile.mapper';
import { ListCreatorsQuery } from './admin.dto';

/** One CSV cell: null → empty, formula-injection guard, RFC 4180 quoting. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  const isPlainNumber = typeof value === 'number' || /^-\d+(\.\d+)?$/.test(s);
  if (/^[=+\-@\t\r]/.test(s) && !isPlainNumber) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type Row = ReturnType<typeof mapProfile> & {};

const TIER_LABELS: Record<string, string> = {
  core_creator: 'Core Creator',
  campaign_creator: 'Campaign Creator',
  vcc_community: 'VCC Community',
  inactive: 'Inactive',
};

const ist = (v: unknown) =>
  v ? new Date(v as string).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }) : '';

const COLUMNS: [string, (r: Row) => unknown][] = [
  ['Full name', (r) => r.fullName],
  ['Email', (r) => r.email],
  ['Phone', (r) => (r.phone ? `+91 ${r.phone}` : '')],
  ['City', (r) => r.city],
  ['Status', (r) => r.status],
  ['Tier', (r) => TIER_LABELS[r.tier] ?? r.tier],
  ['Coordination', (r) => (r.coordinationMode === 'manager' ? 'Through manager' : 'Direct')],
  ['Manager name', (r) => r.managerName],
  ['Manager contact', (r) => r.managerContact],
  ['Core platform', (r) => r.corePlatform],
  ['Instagram', (r) => r.instagramHandle],
  ['Instagram URL', (r) => r.instagramUrl],
  ['Instagram followers', (r) => r.instagramFollowers],
  ['YouTube', (r) => r.youtubeHandle],
  ['YouTube URL', (r) => r.youtubeUrl],
  ['YouTube subscribers', (r) => r.youtubeSubscribers],
  ['Facebook URL', (r) => r.facebookUrl],
  ['Facebook followers', (r) => r.facebookFollowers],
  ['LinkedIn URL', (r) => r.linkedinUrl],
  ['LinkedIn followers', (r) => r.linkedinFollowers],
  ['Threads', (r) => r.threadsHandle],
  ['Threads followers', (r) => r.threadsFollowers],
  ['Other platforms', (r) => r.otherPlatforms],
  ['Content category', (r) => r.contentCategory],
  ['Content languages', (r) => r.contentLanguages.join(', ')],
  ['Content types', (r) => r.contentTypes.join(', ')],
  ['Rate story (INR)', (r) => r.rateStory],
  ['Rate post (INR)', (r) => r.ratePost],
  ['Rate reel (INR)', (r) => r.rateReel],
  ['Rate TVC (INR)', (r) => r.rateTvc],
  ['Worked with Vivo', (r) => (r.workedWithVivo ? 'Yes' : 'No')],
  ['Vivo work details', (r) => r.vivoWorkDetails],
  ['About (bio)', (r) => r.bio],
  ['Enrolled at (IST)', (r) => ist(r.enrolledAt)],
  ['Approved at (IST)', (r) => ist(r.approvedAt)],
  ['Admin notes', (r) => r.adminNotes],
];

@Injectable()
export class CsvExportService {
  constructor(private readonly db: DbService) {}

  async creatorsCsv(q: ListCreatorsQuery): Promise<string> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (q.search) {
      params.push(`%${q.search.replace(/[%_\\]/g, (m) => `\\${m}`)}%`);
      const i = params.length;
      where.push(
        `(full_name ilike $${i} or instagram_handle ilike $${i} or city ilike $${i} or email ilike $${i})`,
      );
    }
    if (q.status) {
      params.push(q.status);
      where.push(`status = $${params.length}`);
    }
    if (q.tier) {
      params.push(q.tier);
      where.push(`tier = $${params.length}`);
    }
    const w = where.length ? `where ${where.join(' and ')}` : '';
    const rows = await this.db.query(
      `select * from creator_profiles ${w} order by enrolled_at desc`,
      params,
    );
    const lines = [COLUMNS.map(([h]) => csvCell(h)).join(',')];
    for (const row of rows) {
      const r = mapProfile(row)!;
      lines.push(COLUMNS.map(([, get]) => csvCell(get(r))).join(','));
    }
    return '\uFEFF' + lines.join('\r\n');
  }
}
