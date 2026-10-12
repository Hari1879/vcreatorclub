import { csvCell } from './csv-export.service';

describe('csvCell', () => {
  it('leaves null/undefined empty', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('a\nb')).toBe('"a\nb"');
  });
  it('guards formula injection', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('@cmd')).toBe("'@cmd");
  });
  it('keeps plain negative numbers unchanged', () => {
    expect(csvCell('-5')).toBe('-5');
    expect(csvCell(-5)).toBe('-5');
  });
});
