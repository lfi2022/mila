export const queryKeys = {
  lists: (userId?: string) => ["lists", userId] as const,
  list: (listId: string) => ["list", listId] as const,
  gifts: (listId: string) => ["gifts", listId] as const,
  reservations: (listId: string) => ["reservations", listId] as const,
  notifications: (userId?: string) => ["notifications", userId] as const,
};
