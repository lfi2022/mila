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
  coverUrl: (list: Pick<MilaList, "coverMediaKey">) =>
    list.coverMediaKey ? buildAssetUrl("list-cover", list.coverMediaKey) : null,
};
