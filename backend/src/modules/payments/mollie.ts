import { fetch } from "undici";

import { AppError } from "../../common/errors/app-error.js";
import type { AppConfig } from "../../config/env.js";

export type MollieMoney = { currency: string; value: string };
export type MolliePayment = {
  resource: "payment";
  id: string;
  mode: "test" | "live";
  status: "open" | "pending" | "authorized" | "paid" | "failed" | "expired" | "canceled";
  amount: MollieMoney;
  amountRefunded?: MollieMoney;
  metadata: { internalPaymentId?: string } | string | null;
  paidAt?: string;
  _links: { checkout?: { href: string }; self?: { href: string } };
};
export type MollieRefund = {
  resource: "refund";
  id: string;
  status: "queued" | "pending" | "processing" | "refunded" | "failed" | "canceled";
  amount: MollieMoney;
  createdAt?: string;
};
export type MollieChargeback = {
  resource: "chargeback";
  id: string;
  amount: MollieMoney;
  reason?: { code?: string; description?: string };
  createdAt: string;
};
type Collection<T> = { _embedded?: Record<string, T[]> };

export interface PaymentProviderClient {
  createPayment(input: {
    amountMinor: bigint;
    currency: string;
    description: string;
    redirectUrl: string;
    webhookUrl: string;
    internalPaymentId: string;
    idempotencyKey: string;
  }): Promise<MolliePayment>;
  getPayment(id: string): Promise<MolliePayment>;
  createRefund(input: {
    paymentId: string;
    amountMinor: bigint;
    currency: string;
    description: string;
    internalRefundId: string;
    idempotencyKey: string;
  }): Promise<MollieRefund>;
  listRefunds(paymentId: string): Promise<MollieRefund[]>;
  listChargebacks(paymentId: string): Promise<MollieChargeback[]>;
  listMethods(
    amountMinor: bigint,
    currency: string,
  ): Promise<Array<{ id: string; description: string; image?: string }>>;
}

export class MollieClient implements PaymentProviderClient {
  constructor(private readonly config: AppConfig) {}

  createPayment(input: Parameters<PaymentProviderClient["createPayment"]>[0]) {
    return this.request<MolliePayment>("/payments", {
      method: "POST",
      idempotencyKey: input.idempotencyKey,
      body: {
        amount: money(input.amountMinor, input.currency),
        description: input.description,
        redirectUrl: input.redirectUrl,
        webhookUrl: input.webhookUrl,
        metadata: { internalPaymentId: input.internalPaymentId },
      },
    });
  }

  getPayment(id: string) {
    return this.request<MolliePayment>(`/payments/${encodeURIComponent(id)}`);
  }

  createRefund(input: Parameters<PaymentProviderClient["createRefund"]>[0]) {
    return this.request<MollieRefund>(`/payments/${encodeURIComponent(input.paymentId)}/refunds`, {
      method: "POST",
      idempotencyKey: input.idempotencyKey,
      body: {
        amount: money(input.amountMinor, input.currency),
        description: input.description,
        metadata: { internalRefundId: input.internalRefundId },
      },
    });
  }

  async listRefunds(paymentId: string) {
    const value = await this.request<Collection<MollieRefund>>(
      `/payments/${encodeURIComponent(paymentId)}/refunds?limit=250`,
    );
    return value._embedded?.["refunds"] ?? [];
  }

  async listChargebacks(paymentId: string) {
    const value = await this.request<Collection<MollieChargeback>>(
      `/payments/${encodeURIComponent(paymentId)}/chargebacks?limit=250`,
    );
    return value._embedded?.["chargebacks"] ?? [];
  }

  async listMethods(amountMinor: bigint, currency: string) {
    const query = new URLSearchParams({
      "amount[value]": minorToDecimal(amountMinor),
      "amount[currency]": currency,
      locale: "fr_BE",
    });
    const value = await this.request<
      Collection<{ id: string; description: string; image?: { svg?: string; size2x?: string } }>
    >(`/methods?${query.toString()}`);
    return (value._embedded?.["methods"] ?? []).map((method) => ({
      id: method.id,
      description: method.description,
      image: method.image?.svg ?? method.image?.size2x,
    }));
  }

  private async request<T>(
    path: string,
    options: { method?: "POST"; body?: unknown; idempotencyKey?: string } = {},
  ): Promise<T> {
    if (!this.config.FEATURE_MOLLIE_PAYMENTS)
      throw new AppError(404, "MOLLIE_DISABLED", "Mollie payments are disabled");
    const response = await fetch(`${this.config.MOLLIE_API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        authorization: `Bearer ${this.config.MOLLIE_API_KEY}`,
        accept: "application/hal+json",
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(options.idempotencyKey ? { "idempotency-key": options.idempotencyKey } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(this.config.MOLLIE_TIMEOUT_MS),
    }).catch((error: unknown) => {
      throw new AppError(502, "MOLLIE_UNAVAILABLE", "Payment provider is unavailable", {
        cause: error instanceof Error ? error.name : "unknown",
      });
    });
    const payload = (await response.json().catch(() => null)) as
      (T & { detail?: string; title?: string }) | null;
    if (!response.ok)
      throw new AppError(502, "MOLLIE_REQUEST_FAILED", "Payment provider rejected the request", {
        providerStatus: response.status,
        providerMessage: payload?.detail ?? payload?.title,
      });
    if (!payload)
      throw new AppError(502, "MOLLIE_RESPONSE_INVALID", "Payment provider response is invalid");
    return payload;
  }
}

export function minorToDecimal(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

export function decimalToMinor(value: string): bigint {
  if (!/^\d+\.\d{2}$/.test(value))
    throw new AppError(502, "MOLLIE_AMOUNT_INVALID", "Payment provider amount is invalid");
  const [units, cents] = value.split(".") as [string, string];
  return BigInt(units) * 100n + BigInt(cents);
}

function money(value: bigint, currency: string): MollieMoney {
  return { currency, value: minorToDecimal(value) };
}
