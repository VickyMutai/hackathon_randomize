import type { Participant, Team } from "./teamAllocator";

export const STORAGE_KEY = "ciris-team-builder:v1";

export type StoredAppState = {
  participants: Participant[];
  teams: Team[];
  minSize: number;
  maxSize: number;
  view: "participants" | "teams";
};

function isParticipant(value: unknown): value is Participant {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.institution === "string"
  );
}

function isTeam(value: unknown): value is Team {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "number" &&
    Array.isArray(item.members) &&
    item.members.every(isParticipant)
  );
}

export function decodeStoredState(raw: string | null): StoredAppState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredAppState>;
    if (
      !Array.isArray(value.participants) ||
      !value.participants.every(isParticipant) ||
      !Array.isArray(value.teams) ||
      !value.teams.every(isTeam) ||
      !Number.isInteger(value.minSize) ||
      !Number.isInteger(value.maxSize) ||
      value.minSize! < 1 ||
      value.maxSize! < value.minSize! ||
      (value.view !== "participants" && value.view !== "teams")
    ) {
      return null;
    }
    return value as StoredAppState;
  } catch {
    return null;
  }
}

export function encodeStoredState(state: StoredAppState) {
  return JSON.stringify(state);
}
