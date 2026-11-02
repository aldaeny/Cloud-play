// Response allowlists: never return password hashes or profile PIN hashes to clients.
export const publicProfileSelect = {
  id: true, userId: true, name: true, avatarUrl: true, maturityMax: true,
  isKid: true, createdAt: true,
} as const;

export const publicStaffSelect = {
  id: true, tenantId: true, email: true, roleId: true, createdAt: true,
} as const;
