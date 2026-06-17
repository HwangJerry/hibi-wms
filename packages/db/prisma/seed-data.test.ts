import { describe, expect, it } from "vitest";
import { seedUsers } from "./seed-data.js";

const ARGON2ID_PHC_HASH_PATTERN =
  /^\$argon2id\$v=\d+\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/]+={0,2}\$[A-Za-z0-9+/]+={0,2}$/;

describe("seed users", () => {
  it("uses Argon2id PHC password hashes", () => {
    for (const user of seedUsers) {
      expect(user.passwordHash).toMatch(ARGON2ID_PHC_HASH_PATTERN);
    }
  });
});
