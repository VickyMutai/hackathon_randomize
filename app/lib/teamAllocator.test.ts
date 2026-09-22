import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { allocateTeams, normalizeInstitution, Participant, swapMembers, validateParticipants, validateTeams } from './teamAllocator';
import { buildExportRows, parseParticipantWorkbook, teamsToCsv } from './tabular';

const people = (institutions: string[]): Participant[] => institutions.map((institution, index) => ({
  id: `p${index}`,
  name: `Person ${index}`,
  institution,
  email: `person${index}@example.org`,
  phone: `+25470000${String(index).padStart(4, '0')}`,
}));

describe('participant validation', () => {
  it('requires names and institutions', () => {
    const issues = validateParticipants([{ id: '1', name: '', institution: '' }]);
    expect(issues.filter((issue) => issue.type === 'error')).toHaveLength(2);
  });

  it('normalizes capitalization and repeated whitespace', () => {
    expect(normalizeInstitution('  Eldoret   National Polytechnic ')).toBe(normalizeInstitution('eldoret national polytechnic'));
  });

  it('detects duplicates by email, phone, or matching name and institution', () => {
    const input = people(['A', 'B']);
    input[1].email = input[0].email;
    expect(validateParticipants(input).some((issue) => issue.message.includes('possible duplicate'))).toBe(true);
  });
});

describe('constraint allocation', () => {
  it('allocates different institutions into valid teams', () => {
    const result = allocateTeams(people(['A','B','C','D','E','F','G','H','I','J']), 3, 5, () => 0.4);
    expect(result.ok).toBe(true);
    if (result.ok) expect(validateTeams(result.teams, 3, 5)).toEqual([]);
  });

  it('separates repeated institutions and balances uneven counts', () => {
    const result = allocateTeams(people(['A','A','A','B','B','C','C','D','E','F','G']), 3, 5, () => 0.7);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(validateTeams(result.teams, 3, 5)).toEqual([]);
      const sizes = result.teams.map((team) => team.members.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
  });

  it('honors minimum and maximum sizes', () => {
    for (const count of [6, 7, 8, 9, 10, 11, 14, 17]) {
      const result = allocateTeams(people(Array.from({ length: count }, (_, i) => `I${i}`)), 3, 5);
      expect(result.ok).toBe(true);
      if (result.ok) result.teams.forEach((team) => {
        expect(team.members.length).toBeGreaterThanOrEqual(3);
        expect(team.members.length).toBeLessThanOrEqual(5);
      });
    }
  });

  it('rejects an impossible institution distribution', () => {
    const result = allocateTeams(people(['A','A','A','A','A','B','C','D','E','F','G','H']), 3, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('A has 5 participants');
  });

  it('re-randomizes while preserving every constraint', () => {
    const input = people(['A','A','B','B','C','C','D','D','E','E','F','F']);
    const signatures = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      const result = allocateTeams(input, 3, 5);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(validateTeams(result.teams, 3, 5)).toEqual([]);
        signatures.add(result.teams.map((team) => team.members.map((member) => member.id).join('-')).join('|'));
      }
    }
    expect(signatures.size).toBeGreaterThan(1);
  });

  it('rejects invalid swaps and accepts valid swaps', () => {
    const validTeams = [{ id: 1, members: people(['A','B','C']).map((p, i) => ({ ...p, id: `a${i}` })) }, { id: 2, members: people(['A','D','E']).map((p, i) => ({ ...p, id: `b${i}` })) }];
    expect(swapMembers(validTeams, 'a1', 'b1', 3, 5).ok).toBe(true);
    expect(swapMembers(validTeams, 'a0', 'b1', 3, 5).ok).toBe(false);
  });

  it('survives repeated randomized datasets without duplicate institutions', () => {
    for (let run = 0; run < 100; run += 1) {
      const count = 12 + (run % 24);
      const institutions = Array.from({ length: count }, (_, i) => `Institution ${i % Math.ceil(count / 3)}`);
      const result = allocateTeams(people(institutions), 3, 5);
      if (result.ok) expect(validateTeams(result.teams, 3, 5)).toEqual([]);
    }
  });
});

describe('spreadsheet interchange', () => {
  it('imports CSV and Excel-compatible workbooks', () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet([{ 'Full Name': 'Ada N.', 'Institution / Organisation': 'Farm Lab', 'Email Address': 'ada@example.org' }]), 'Participants');
    const data = XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const parsed = parseParticipantWorkbook(data, () => 'fixed-id');
    expect(parsed[0]).toMatchObject({ id: 'fixed-id', name: 'Ada N.', institution: 'Farm Lab', email: 'ada@example.org' });
  });

  it('exports the required columns in CSV and Excel row data', () => {
    const teams = [{ id: 1, members: people(['A','B','C']) }];
    expect(Object.keys(buildExportRows(teams)[0])).toEqual(['Team Number','Participant Name','Institution','Email','Phone']);
    expect(teamsToCsv(teams).split('\n')[0]).toBe('Team Number,Participant Name,Institution,Email,Phone');
  });
});
