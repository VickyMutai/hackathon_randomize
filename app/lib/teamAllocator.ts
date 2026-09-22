export type Participant = {
  id: string;
  name: string;
  institution: string;
  email?: string;
  phone?: string;
  skill?: string;
};

export type Team = { id: number; members: Participant[] };

export type ValidationIssue = {
  participantId?: string;
  type: 'error' | 'warning';
  message: string;
};

export const normalizeInstitution = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

const normalizeName = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

const normalizePhone = (value = '') => value.replace(/[^\d+]/g, '');

export function validateParticipants(participants: Participant[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenName = new Map<string, Participant>();
  const seenEmail = new Map<string, Participant>();
  const seenPhone = new Map<string, Participant>();

  participants.forEach((participant, index) => {
    const label = participant.name.trim() || `Row ${index + 1}`;
    if (!participant.name.trim()) {
      issues.push({ participantId: participant.id, type: 'error', message: `Row ${index + 1}: participant name is required.` });
    }
    if (!participant.institution.trim()) {
      issues.push({ participantId: participant.id, type: 'error', message: `${label}: institution / organisation is required.` });
    }
    if (participant.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(participant.email.trim())) {
      issues.push({ participantId: participant.id, type: 'error', message: `${label}: email address is invalid.` });
    }

    const nameKey = normalizeName(participant.name);
    const emailKey = participant.email?.trim().toLocaleLowerCase() || '';
    const phoneKey = normalizePhone(participant.phone);
    const priorName = nameKey ? seenName.get(nameKey) : undefined;
    const priorEmail = emailKey ? seenEmail.get(emailKey) : undefined;
    const priorPhone = phoneKey ? seenPhone.get(phoneKey) : undefined;

    if (priorEmail || priorPhone || (priorName && normalizeInstitution(priorName.institution) === normalizeInstitution(participant.institution))) {
      const matched = priorEmail || priorPhone || priorName;
      issues.push({ participantId: participant.id, type: 'error', message: `${label}: possible duplicate of ${matched?.name || 'another participant'}.` });
    } else if (priorName) {
      issues.push({ participantId: participant.id, type: 'warning', message: `${label}: another participant has the same name. Please review.` });
    }

    if (nameKey) seenName.set(nameKey, participant);
    if (emailKey) seenEmail.set(emailKey, participant);
    if (phoneKey) seenPhone.set(phoneKey, participant);
  });
  return issues;
}

function shuffle<T>(values: T[], random: () => number): T[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function teamCountFor(total: number, minSize: number, maxSize: number, largestGroup: number) {
  const minimumTeams = Math.max(Math.ceil(total / maxSize), largestGroup);
  const maximumTeams = Math.floor(total / minSize);
  return minimumTeams <= maximumTeams ? minimumTeams : null;
}

export type AllocationResult =
  | { ok: true; teams: Team[] }
  | { ok: false; message: string; suggestion: string };

export function allocateTeams(participants: Participant[], minSize = 3, maxSize = 5, random: () => number = Math.random): AllocationResult {
  if (minSize < 1 || maxSize < minSize) {
    return { ok: false, message: 'Team-size settings are invalid.', suggestion: 'Choose a minimum of at least 1 and a maximum that is not smaller.' };
  }
  if (!participants.length) {
    return { ok: false, message: 'There are no participants to allocate.', suggestion: 'Add participants manually or upload a file first.' };
  }

  const groups = new Map<string, Participant[]>();
  participants.forEach((participant) => {
    const key = normalizeInstitution(participant.institution);
    groups.set(key, [...(groups.get(key) || []), participant]);
  });
  const largest = [...groups.values()].sort((a, b) => b.length - a.length)[0];
  const teamCount = teamCountFor(participants.length, minSize, maxSize, largest.length);
  if (!teamCount) {
    const baseTeams = Math.max(1, Math.ceil(participants.length / maxSize));
    const institution = largest[0]?.institution || 'One institution';
    return {
      ok: false,
      message: `Team allocation cannot be completed. ${institution} has ${largest.length} participants, while the current size limits can support at most ${Math.floor(participants.length / minSize)} valid teams (${baseTeams} would normally be needed).`,
      suggestion: 'Review duplicates, reduce the minimum team size, increase the participant pool, or change the team-size range.',
    };
  }

  const targets = Array.from({ length: teamCount }, (_, i) => Math.floor(participants.length / teamCount) + (i < participants.length % teamCount ? 1 : 0));
  const orderedGroups = [...groups.values()].map((group) => shuffle(group, random)).sort((a, b) => b.length - a.length || random() - 0.5);
  const ordered = orderedGroups.flat();
  const teams: Team[] = targets.map((_, index) => ({ id: index + 1, members: [] }));
  const institutions = teams.map(() => new Set<string>());

  const search = (index: number): boolean => {
    if (index === ordered.length) return true;
    const participant = ordered[index];
    const key = normalizeInstitution(participant.institution);
    const candidates = shuffle(
      teams.map((team, teamIndex) => ({ team, teamIndex })).filter(({ team, teamIndex }) => team.members.length < targets[teamIndex] && !institutions[teamIndex].has(key)),
      random,
    ).sort((a, b) => a.team.members.length - b.team.members.length);
    for (const { team, teamIndex } of candidates) {
      team.members.push(participant);
      institutions[teamIndex].add(key);
      if (search(index + 1)) return true;
      team.members.pop();
      institutions[teamIndex].delete(key);
    }
    return false;
  };

  if (!search(0)) {
    return { ok: false, message: 'No valid allocation was found for this participant distribution.', suggestion: 'Review the institution distribution or adjust the team-size range.' };
  }
  return { ok: true, teams };
}

export function validateTeams(teams: Team[], minSize: number, maxSize: number): string[] {
  const errors: string[] = [];
  const assigned = new Set<string>();
  teams.forEach((team) => {
    if (team.members.length < minSize || team.members.length > maxSize) errors.push(`Team ${team.id} must have ${minSize}–${maxSize} members.`);
    const institutionKeys = team.members.map((member) => normalizeInstitution(member.institution));
    if (new Set(institutionKeys).size !== institutionKeys.length) errors.push(`Team ${team.id} would contain duplicate institutions.`);
    team.members.forEach((member) => {
      if (assigned.has(member.id)) errors.push(`${member.name} is assigned more than once.`);
      assigned.add(member.id);
    });
  });
  return errors;
}

export function swapMembers(teams: Team[], firstId: string, secondId: string, minSize: number, maxSize: number): AllocationResult {
  const copy = teams.map((team) => ({ ...team, members: [...team.members] }));
  const firstTeam = copy.find((team) => team.members.some((member) => member.id === firstId));
  const secondTeam = copy.find((team) => team.members.some((member) => member.id === secondId));
  if (!firstTeam || !secondTeam || firstTeam.id === secondTeam.id) {
    return { ok: false, message: 'Choose two participants from different teams.', suggestion: 'Select one member in each of two teams.' };
  }
  const firstIndex = firstTeam.members.findIndex((member) => member.id === firstId);
  const secondIndex = secondTeam.members.findIndex((member) => member.id === secondId);
  [firstTeam.members[firstIndex], secondTeam.members[secondIndex]] = [secondTeam.members[secondIndex], firstTeam.members[firstIndex]];
  const errors = validateTeams(copy, minSize, maxSize);
  return errors.length
    ? { ok: false, message: errors[0], suggestion: 'Choose participants whose institutions do not already appear in the destination teams.' }
    : { ok: true, teams: copy };
}

export function moveMember(teams: Team[], participantId: string, destinationId: number, minSize: number, maxSize: number): AllocationResult {
  const copy = teams.map((team) => ({ ...team, members: [...team.members] }));
  const source = copy.find((team) => team.members.some((member) => member.id === participantId));
  const destination = copy.find((team) => team.id === destinationId);
  if (!source || !destination || source.id === destination.id) {
    return { ok: false, message: 'Choose a different destination team.', suggestion: 'Select another team and try again.' };
  }
  const member = source.members.find((item) => item.id === participantId)!;
  source.members = source.members.filter((item) => item.id !== participantId);
  destination.members.push(member);
  const errors = validateTeams(copy, minSize, maxSize);
  return errors.length
    ? { ok: false, message: errors[0], suggestion: 'Try a swap instead, or choose a team with capacity and no matching institution.' }
    : { ok: true, teams: copy };
}
