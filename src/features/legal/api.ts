import { apiRequest } from "@/services/api/client";

export type LegalConfig = {
  operatorName: string;
  businessName: string;
  tradeName: string;
  businessNumber: string;
  registeredAddress: string;
  country: string;
  generalEmail: string;
  privacyEmail: string;
  supportEmail: string;
  reportEmail: string;
  hostingProvider: string;
  publicationDirector: string;
  versions: { terms: string; privacy: string; cookies: string };
};

export const getLegalConfig = () => apiRequest<LegalConfig>("/legal/config");
