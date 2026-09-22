import * as XLSX from 'xlsx';
import type { Participant, Team } from './teamAllocator';

const aliases = {
  name: ['full name', 'name', 'participant name'],
  institution: ['institution', 'institution / organisation', 'institution/organisation', 'organisation', 'organization'],
  email: ['email', 'email address'],
  phone: ['phone', 'phone number'],
  skill: ['skill', 'area of expertise', 'skill/area of expertise'],
};

function valueFor(row: Record<string, unknown>, names: string[]) {
  const key = Object.keys(row).find((item) => names.includes(item.trim().toLowerCase()));
  return key ? String(row[key] ?? '') : '';
}

export function parseParticipantWorkbook(data: ArrayBuffer, idFactory: () => string = () => crypto.randomUUID()): Participant[] {
  const workbook = XLSX.read(data);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return rows.map((row) => ({
    id: idFactory(),
    name: valueFor(row, aliases.name),
    institution: valueFor(row, aliases.institution),
    email: valueFor(row, aliases.email),
    phone: valueFor(row, aliases.phone),
    skill: valueFor(row, aliases.skill),
  }));
}

export function buildExportRows(teams: Team[]) {
  return teams.flatMap((team) => team.members.map((member) => ({
    'Team Number': team.id,
    'Participant Name': member.name,
    Institution: member.institution,
    Email: member.email || '',
    Phone: member.phone || '',
  })));
}

function escapeCsv(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function teamsToCsv(teams: Team[]) {
  const headers = ['Team Number', 'Participant Name', 'Institution', 'Email', 'Phone'];
  const rows = buildExportRows(teams);
  return [headers.join(','), ...rows.map((row) => headers.map((header) => escapeCsv(row[header as keyof typeof row])).join(','))].join('\n');
}
