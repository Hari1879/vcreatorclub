import { addDays, parseDate, validateCoCreate } from './validation';

const TODAY = '2025-01-10';
const fields = (b: Record<string, unknown>) =>
  validateCoCreate({ supportType: 'borrow', ...b }, TODAY).errors.map(
    (e) => e.field,
  );

describe('co-create validation', () => {
  it('rejects non-object bodies', () => {
    expect(validateCoCreate(null, TODAY).errors[0].field).toBe('body');
    expect(validateCoCreate([], TODAY).errors[0].field).toBe('body');
  });

  it('reports required fields and never yields a value on errors', () => {
    const r = validateCoCreate({ supportType: 'borrow' }, TODAY);
    expect(r.value).toBeNull();
    expect(r.errors.length).toBeGreaterThan(3);
    expect(r.errors.map((e) => e.field)).toEqual(
      expect.arrayContaining(['3.8', '3.9']),
    );
  });

  it('shoot date must be after today', () => {
    expect(fields({ shootDate: TODAY })).toContain('3.8');
    expect(fields({ shootDate: '2025-01-11' })).not.toContain('3.8');
  });

  it('posting date must be 2+ days after shoot', () => {
    const f = fields({ shootDate: '2025-02-01', postingDate: '2025-02-02' });
    expect(f).toContain('3.9');
    const g = fields({ shootDate: '2025-02-01', postingDate: '2025-02-03' });
    expect(g).not.toContain('3.9');
  });

  it('requires reconfirmation when not submitting for review', () => {
    expect(fields({ submitForReview: false })).toContain('3.10a');
    expect(
      fields({ submitForReview: false, reviewReconfirmed: true }),
    ).not.toContain('3.10a');
  });

  it('requires terms acceptance', () => {
    expect(fields({ termsAccepted: false })).toContain('terms');
  });

  it('date helpers', () => {
    expect(parseDate('2025-02-30')).toBeNull();
    expect(parseDate('2025-02-28')).toBe('2025-02-28');
    expect(addDays('2025-01-31', 1)).toBe('2025-02-01');
  });
});
