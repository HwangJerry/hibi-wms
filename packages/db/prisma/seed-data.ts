export const seedUsers = [
  {
    id: "seed-user-alex",
    email: "alex@hibi.local",
    name: "Alex Kim",
    // Local dev password: alex-local-password
    passwordHash:
      "$argon2id$v=19$m=65536,t=3,p=4$M97bwXe/ZlG3dU3ZzjjStA$OmAXKyvGOvNl6dvhe5zmD+E8MHmTVqOJfSHP5k5L34Y",
  },
  {
    id: "seed-user-jamie",
    email: "jamie@hibi.local",
    name: "Jamie Park",
    // Local dev password: jamie-local-password
    passwordHash:
      "$argon2id$v=19$m=65536,t=3,p=4$qEgLNsXk5rVv8/dJFvkbYw$7aW0tu2GbA/zklQuENaiJGVXtqLdatYRSxJ4IhEXBpw",
  },
] as const;
