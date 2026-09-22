import { describe, expect, it } from "vitest";
import {
  decodeStoredState,
  encodeStoredState,
  StoredAppState,
} from "./browserStorage";

const state: StoredAppState = {
  participants: [{ id: "p1", name: "Amina", institution: "Farm Lab" }],
  teams: [
    {
      id: 1,
      members: [{ id: "p1", name: "Amina", institution: "Farm Lab" }],
    },
  ],
  minSize: 3,
  maxSize: 5,
  view: "teams",
};

describe("browser storage", () => {
  it("round-trips valid application state", () => {
    expect(decodeStoredState(encodeStoredState(state))).toEqual(state);
  });

  it("ignores missing or corrupted saved data", () => {
    expect(decodeStoredState(null)).toBeNull();
    expect(decodeStoredState("{invalid")).toBeNull();
    expect(
      decodeStoredState(JSON.stringify({ participants: "wrong" })),
    ).toBeNull();
  });

  it("rejects invalid team-size settings", () => {
    expect(
      decodeStoredState(
        encodeStoredState({ ...state, minSize: 6, maxSize: 5 }),
      ),
    ).toBeNull();
  });
});
