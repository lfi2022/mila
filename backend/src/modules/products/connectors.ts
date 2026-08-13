import type { AppConfig } from "../../config/env.js";
import { extractProduct, type ProductPreview } from "./extractor.js";

export type ConnectorTrustLevel = 0 | 1 | 2 | 3 | 4;
export type ConnectorCapability = "metadata" | "price" | "availability" | "images" | "offers";

export interface MerchantConnector {
  readonly id: string;
  readonly trustLevel: ConnectorTrustLevel;
  readonly capabilities: readonly ConnectorCapability[];
  supports(url: URL): boolean;
  preview(url: URL): Promise<ProductPreview>;
}

export class StructuredMetadataConnector implements MerchantConnector {
  readonly id = "structured-metadata";
  readonly trustLevel = 1 as const;
  readonly capabilities = ["metadata", "price", "availability", "images"] as const;
  constructor(private readonly config: AppConfig) {}
  supports(url: URL): boolean {
    return ["https:", "http:"].includes(url.protocol);
  }
  preview(url: URL): Promise<ProductPreview> {
    return extractProduct(url.toString(), this.config);
  }
}

/** Levels: 0 manual, 1 public metadata, 2 authorized feed, 3 official read API, 4 authorized write API. */
export function selectConnector(url: URL, connectors: readonly MerchantConnector[]) {
  return connectors
    .filter((connector) => connector.supports(url))
    .sort((a, b) => b.trustLevel - a.trustLevel)[0];
}
