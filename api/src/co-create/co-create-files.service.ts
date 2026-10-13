import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { DbService } from '../db/db.service';
import { cleanText } from './validation';

const MB = 1024 * 1024;
const RULES: Record<string, { exts: string[]; maxBytes: number }> = {
  idea_doc: { exts: ['pdf', 'ppt', 'pptx', 'doc', 'docx'], maxBytes: 10 * MB },
  gst_proforma: { exts: ['pdf'], maxBytes: 5 * MB },
};
const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
export const SIGNED_URL_TTL_SECONDS = 60;
export const UPLOADS_PER_HOUR = 20;

/** The extension must agree with the real file signature (magic bytes). */
function contentMatches(ext: string, buf: Buffer): boolean {
  const startsWith = (sig: number[]) => sig.every((b, i) => buf[i] === b);
  if (ext === 'pdf') return startsWith([0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (ext === 'doc' || ext === 'ppt')
    return startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  if (ext === 'docx' || ext === 'pptx') {
    if (!startsWith([0x50, 0x4b, 0x03, 0x04])) return false;
    // Entry names are stored uncompressed in the zip directory.
    return buf.includes(Buffer.from(ext === 'docx' ? 'word/' : 'ppt/'));
  }
  return false;
}

@Injectable()
export class CoCreateFilesService {
  constructor(
    private readonly db: DbService,
    private readonly config: ConfigService,
  ) {}

  async upload(creatorId: string, kind: unknown, file?: Express.Multer.File) {
    if (typeof kind !== 'string' || !RULES[kind]) {
      throw new BadRequestException('kind must be idea_doc or gst_proforma.');
    }
    if (!file || !file.buffer?.length)
      throw new BadRequestException('Choose a file to upload.');
    const rule = RULES[kind];
    const ext = (file.originalname.split('.').pop() ?? '').toLowerCase();
    if (!rule.exts.includes(ext)) {
      throw new BadRequestException(
        `Allowed file types: ${rule.exts.map((e) => `.${e}`).join(' ')}`,
      );
    }
    if (file.size > rule.maxBytes) {
      throw new BadRequestException(
        `File must be ${rule.maxBytes / MB} MB or smaller.`,
      );
    }
    if (!contentMatches(ext, file.buffer)) {
      throw new BadRequestException(
        'The file content does not match its type.',
      );
    }

    const recent = await this.db.one<{ n: number }>(
      `select count(*)::int as n from co_create_files
        where creator_id = $1 and created_at > now() - interval '1 hour'`,
      [creatorId],
    );
    if ((recent?.n ?? 0) >= UPLOADS_PER_HOUR) {
      throw new HttpException(
        'Upload limit reached. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Original name is display metadata only; the storage key is random.
    const name =
      cleanText(file.originalname.split(/[\\/]/).pop() ?? 'file').slice(
        0,
        200,
      ) || `file.${ext}`;
    const row = await this.db.one<{ id: string }>(
      `insert into co_create_files (creator_id, kind, original_name, mime, size_bytes, storage_key, data)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [
        creatorId,
        kind,
        name,
        MIME[ext],
        file.size,
        randomBytes(24).toString('hex'),
        file.buffer,
      ],
    );
    return { fileId: row!.id };
  }

  private key() {
    const secret = this.config.getOrThrow<string>('SESSION_SECRET');
    return createHash('sha256').update(`co-create-file:${secret}`).digest();
  }

  /** Short-lived, tamper-proof download token for one file. */
  sign(fileId: string): { url: string; expiresInSeconds: number } {
    const payload = Buffer.from(
      JSON.stringify({
        f: fileId,
        e: Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS,
      }),
    ).toString('base64url');
    const sig = createHmac('sha256', this.key())
      .update(payload)
      .digest('base64url');
    return {
      url: `/api/co-create/files/download?token=${payload}.${sig}`,
      expiresInSeconds: SIGNED_URL_TTL_SECONDS,
    };
  }

  async openSigned(token: string) {
    const [payload, sig] = (token ?? '').split('.');
    if (!payload || !sig) throw new UnauthorizedException('Invalid link.');
    const expected = createHmac('sha256', this.key()).update(payload).digest();
    const given = Buffer.from(sig, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new UnauthorizedException('Invalid link.');
    }
    let claims: { f?: string; e?: number };
    try {
      claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Invalid link.');
    }
    if (!claims.f || !claims.e || claims.e < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('This link has expired.');
    }
    const file = await this.db.one(
      'select original_name, mime, data from co_create_files where id = $1',
      [claims.f],
    );
    if (!file) throw new NotFoundException();
    return file as { original_name: string; mime: string; data: Buffer };
  }
}
