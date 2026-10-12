import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminGuard, SuperAdminOnly } from '../auth/admin.guard';
import { UsersService } from './users.service';

const ME = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

function svc(admins: { id: string; role: string }[], userExists = true) {
  const queries: string[] = [];
  const client = {
    query: jest.fn(async (sql: string) => {
      queries.push(sql);
      if (sql.startsWith('select id from users'))
        return { rowCount: userExists ? 1 : 0, rows: [] };
      if (sql.startsWith('select id, role from admin_users'))
        return { rows: admins, rowCount: admins.length };
      return { rows: [], rowCount: 1 };
    }),
  };
  const db: any = { tx: (fn: any) => fn(client) };
  return { s: new UsersService(db), queries };
}

describe('UsersService.setRole', () => {
  it('rejects changing your own role', async () => {
    const { s } = svc([]);
    await expect(s.setRole(ME, ME, { role: 'viewer' })).rejects.toThrow(
      "You can't change your own role.",
    );
  });

  it('404s for an unknown user', async () => {
    const { s } = svc([{ id: ME, role: 'super_admin' }], false);
    await expect(
      s.setRole(ME, OTHER, { role: 'admin' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks demoting or removing the last super admin', async () => {
    const admins = [
      { id: ME, role: 'admin' },
      { id: OTHER, role: 'super_admin' },
    ];
    for (const role of ['admin', 'viewer', 'none'] as const) {
      const { s } = svc(admins);
      await expect(s.setRole(ME, OTHER, { role })).rejects.toThrow(
        'At least one super admin is required.',
      );
    }
  });

  it('allows demoting a super admin when another remains, locking rows first', async () => {
    const { s, queries } = svc([
      { id: ME, role: 'super_admin' },
      { id: OTHER, role: 'super_admin' },
    ]);
    await expect(s.setRole(ME, OTHER, { role: 'viewer' })).resolves.toEqual({
      id: OTHER,
      role: 'viewer',
    });
    expect(queries.some((q) => q.includes('for update'))).toBe(true);
    expect(queries.some((q) => q.includes('insert into admin_users'))).toBe(
      true,
    );
  });

  it("'none' deletes the admin row", async () => {
    const { s, queries } = svc([
      { id: ME, role: 'super_admin' },
      { id: OTHER, role: 'viewer' },
    ]);
    await expect(s.setRole(ME, OTHER, { role: 'none' })).resolves.toEqual({
      id: OTHER,
      role: null,
    });
    expect(queries.some((q) => q.startsWith('delete from admin_users'))).toBe(
      true,
    );
  });

  it('can promote a user with no admin row', async () => {
    const { s } = svc([{ id: ME, role: 'super_admin' }]);
    await expect(
      s.setRole(ME, OTHER, { role: 'super_admin' }),
    ).resolves.toEqual({ id: OTHER, role: 'super_admin' });
  });
});

describe('AdminGuard @SuperAdminOnly', () => {
  class C {
    @SuperAdminOnly() handler() {}
  }
  const guardFor = (role: string) => {
    const db: any = {
      one: async () => ({ id: ME, name: 'n', email: 'e', role }),
    };
    const session: any = { canActivate: () => true };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ sessionUser: { id: ME } }) }),
      getHandler: () => C.prototype.handler,
      getClass: () => C,
    } as unknown as ExecutionContext;
    return new AdminGuard(session, db, new Reflector()).canActivate(ctx);
  };

  it.each(['admin', 'viewer'])('403 for %s', async (role) => {
    await expect(guardFor(role)).rejects.toThrow(
      new ForbiddenException('Only super admins can manage users.'),
    );
  });
  it('allows super_admin', async () => {
    await expect(guardFor('super_admin')).resolves.toBe(true);
  });
});
