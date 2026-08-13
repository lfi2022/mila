export type PaymentStatus =
  | "CREATED"
  | "PENDING"
  | "AUTHORIZED"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "CHARGEDBACK";

export type Money = { amountMinor: string; currency: string };
