import type { AppConfig } from "../../config/env.js";
import { extractProduct, type ProductPreview } from "./extractor.js";

export type ProductProviderCapabilities = {
  metadata: boolean;
  price: boolean;
  availability: boolean;
  images: boolean;
  imageCache: boolean;
  affiliateLinks: boolean;
};

export interface ProductProvider {
  readonly id: string;
  readonly capabilities: ProductProviderCapabilities;
  supports(url: URL): boolean;
  preview(url: URL): Promise<ProductPreview>;
}

const conservativeCapabilities: ProductProviderCapabilities = {
  metadata: true,
  price: true,
  availability: true,
  images: false,
  imageCache: false,
  affiliateLinks: false,
};

class NamedMetadataProvider implements ProductProvider {
  readonly capabilities = conservativeCapabilities;
  constructor(
    readonly id: string,
    private readonly domains: readonly string[],
    private readonly config: AppConfig,
  ) {}
  supports(url: URL) {
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    return this.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  }
  preview(url: URL) {
    return extractProduct(url.toString(), this.config);
  }
}

export class AmazonProductProvider extends NamedMetadataProvider {
  constructor(config: AppConfig) {
    super("amazon", ["amazon.be", "amazon.fr", "amazon.de", "amazon.nl"], config);
  }
}
export class IkeaProductProvider extends NamedMetadataProvider {
  constructor(config: AppConfig) {
    super("ikea", ["ikea.com"], config);
  }
}
export class VertbaudetProductProvider extends NamedMetadataProvider {
  constructor(config: AppConfig) {
    super("vertbaudet", ["vertbaudet.be", "vertbaudet.fr"], config);
  }
}
export class CybexProductProvider extends NamedMetadataProvider {
  constructor(config: AppConfig) {
    super("cybex", ["cybex-online.com"], config);
  }
}
export class BolProductProvider extends NamedMetadataProvider {
  constructor(config: AppConfig) {
    super("bol", ["bol.com"], config);
  }
}
export class GenericProductProvider extends NamedMetadataProvider {
  constructor(config: AppConfig) {
    super("generic-structured-metadata", [], config);
  }
  override supports(url: URL) {
    return ["http:", "https:"].includes(url.protocol);
  }
}

export function createProductProviders(config: AppConfig): ProductProvider[] {
  return [
    new AmazonProductProvider(config),
    new IkeaProductProvider(config),
    new VertbaudetProductProvider(config),
    new CybexProductProvider(config),
    new BolProductProvider(config),
    new GenericProductProvider(config),
  ];
}

export function selectProductProvider(url: URL, providers: readonly ProductProvider[]) {
  return providers.find((provider) => provider.supports(url));
}
