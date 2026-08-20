import { buildAssetUrl } from "@/config/runtime";
import { apiRequest } from "@/services/api/client";

export type ListType = "BIRTH" | "BIRTHDAY" | "CHRISTENING" | "CHRISTMAS" | "WEDDING" | "OTHER";
export type ListVisibility = "PUBLIC" | "UNLISTED" | "PROTECTED";
export type ListStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export type ListPatch = Partial<{
  title: string;
  slug: string;
  description: string | null;
  welcomeMessage: string | null;
  childName: string | null;
  dueDate: string | null;
  type: ListType;
  visibility: ListVisibility;
  status: ListStatus;
  accessCode: string | null;
  surpriseMode: boolean;
  hideReservedGifts: boolean;
  showReservationNames: boolean;
  allowIndexing: boolean;
  showProgress: boolean;
  theme: string;
  accentColor: string | null;
  heroStyle: "soft" | "cover" | "minimal";
  fontPair: "baloo" | "serif" | "moderne";
  layout: "grid" | "list" | "magazine";
  coverMediaKey: null;
}>;

export type MilaList = ListPatch & {
  id: string;
  ownerId: string;
  title: string;
  slug: string;
  type: ListType;
  visibility: ListVisibility;
  status: ListStatus;
  childName: string | null;
  welcomeMessage: string | null;
  dueDate: string | null;
  coverMediaKey: string | null;
  surpriseMode: boolean;
  hideReservedGifts: boolean;
  showReservationNames: boolean;
  allowIndexing: boolean;
  showProgress: boolean;
  theme: string;
  accentColor: string | null;
  heroStyle: "soft" | "cover" | "minimal";
  fontPair: "baloo" | "serif" | "moderne";
  layout: "grid" | "list" | "magazine";
  _count?: { gifts: number; reservations: number };
  owner?: { id: string; displayName: string | null; email: string };
  members?: Array<{
    id: string;
    userId: string;
    role: "OWNER" | "CO_OWNER" | "EDITOR";
    user: { id: string; displayName: string | null; email: string };
  }>;
  invitations?: Array<{
    id: string;
    email: string;
    role: "OWNER" | "CO_OWNER" | "EDITOR";
    acceptedAt: string | null;
    expiresAt: string;
  }>;
};

export const listApi = {
  async mine() {
    return (await apiRequest<{ lists: MilaList[] }>("/lists")).lists;
  },
  async get(id: string) {
    return (await apiRequest<{ list: MilaList }>(`/lists/${id}`)).list;
  },
  async create(input: ListPatch & { title: string; slug: string }) {
    return (
      await apiRequest<{ list: MilaList }>("/lists", {
        method: "POST",
        csrf: true,
        body: JSON.stringify(input),
      })
    ).list;
  },
  async update(id: string, input: ListPatch) {
    return (
      await apiRequest<{ list: MilaList }>(`/lists/${id}`, {
        method: "PATCH",
        csrf: true,
        body: JSON.stringify(input),
      })
    ).list;
  },
  async invite(id: string, email: string, role: "CO_OWNER" | "EDITOR") {
    return apiRequest<{ invitation: unknown; developmentInvitationToken?: string }>(
      `/lists/${id}/invitations`,
      { method: "POST", csrf: true, body: JSON.stringify({ email, role }) },
    );
  },
  removeMember: (id: string, memberId: string) =>
    apiRequest<void>(`/lists/${id}/members/${memberId}`, { method: "DELETE", csrf: true }),
  lifecycle: (id: string) =>
    apiRequest<{
      lifecycle: {
        status: ListStatus;
        closedAt: string | null;
        archivedAt: string | null;
        memoryBook: {
          id: string;
          exportPreparedAt: string | null;
          _count: { items: number };
        } | null;
        thankYous: { received: number; pending: number };
        confirmedRewardMinor: string;
        futureLists: Array<{
          id: string;
          title: string;
          type: ListType;
          dueDate: string | null;
          status: ListStatus;
        }>;
      };
    }>(`/lists/${id}/lifecycle`).then((result) => result.lifecycle),
  close: (id: string) =>
    apiRequest<{ list: MilaList }>(`/lists/${id}/lifecycle/close`, {
      method: "POST",
      csrf: true,
    }).then((result) => result.list),
  archive: (id: string) =>
    apiRequest<{ list: MilaList }>(`/lists/${id}/lifecycle/archive`, {
      method: "POST",
      csrf: true,
    }).then((result) => result.list),
  createFuture: (
    id: string,
    input: { title: string; slug: string; type: ListType; dueDate?: string | null },
  ) =>
    apiRequest<{ list: MilaList }>(`/lists/${id}/lifecycle/future`, {
      method: "POST",
      csrf: true,
      body: JSON.stringify(input),
    }).then((result) => result.list),
  coverUrl: (list: Pick<MilaList, "coverMediaKey">) =>
    list.coverMediaKey ? buildAssetUrl("list-cover", list.coverMediaKey) : null,
};
