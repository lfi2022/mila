import type { EmailTemplate } from "./templates";

/**
 * Provider abstraction so the email vendor can be swapped without touching
 * any feature code. Resend is wired when a key exists; otherwise sends are
 * recorded in the server log and the calling flow never fails.
 */

export type SendEmailInput = {
  to: string;
  template: EmailTemplate;
  replyTo?: string;
};

export type SendEmailResult = { delivered: boolean; provider: string; reason?: string };

interface EmailProvider {
  readonly name: string;
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

class ResendProvider implements EmailProvider {
  readonly name = "resend";
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send({ to, template, replyTo }: SendEmailInput): Promise<SendEmailResult> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [to],
        subject: template.subject,
        html: template.html,
        text: template.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("[email] resend rejected the message", response.status, detail.slice(0, 300));
      return { delivered: false, provider: this.name, reason: `status_${response.status}` };
    }
    return { delivered: true, provider: this.name };
  }
}

class LogProvider implements EmailProvider {
  readonly name = "log";
  async send({ to, template }: SendEmailInput): Promise<SendEmailResult> {
    console.info(`[email:log] -> ${to} :: ${template.subject}`);
    return { delivered: false, provider: this.name, reason: "no_provider_configured" };
  }
}

function resolveProvider(): EmailProvider {
  const key = process.env["RESEND_API_KEY"];
  if (key) {
    const from = process.env["MILA_EMAIL_FROM"] ?? "Mila <onboarding@resend.dev>";
    return new ResendProvider(key, from);
  }
  return new LogProvider();
}

/** Never throws: a failed notification must not break the user flow. */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  try {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.to)) {
      return { delivered: false, provider: "none", reason: "invalid_address" };
    }
    return await resolveProvider().send(input);
  } catch (error) {
    console.error("[email] unexpected failure", error);
    return { delivered: false, provider: "unknown", reason: "exception" };
  }
}
