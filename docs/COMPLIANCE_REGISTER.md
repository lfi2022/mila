# Mila privacy, legal, and incident register

Status: operational design complete; final legal and financial wording is `BLOCKED_EXTERNAL` pending Belgian counsel/DPO/accounting review.

## Data minimization and purposes

| Data                           | Purpose                                                          | Minimum retention target                                 | Control                                                                        |
| ------------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Account email and display name | authentication and list administration                           | account life plus approved statutory period              | access, correction, JSON export, anonymized deletion                           |
| List/gift content              | provide the shared-list service                                  | until deletion/archive policy                            | role checks, visibility, moderation, deletion                                  |
| Guest reservation identity     | manage the reservation and prevent duplicate inventory           | management-token expiry plus approved operational buffer | optional email, token hash only, parent visibility                             |
| Contribution/payment records   | direct transfer instructions, receipt evidence and fraud control | `BLOCKED_EXTERNAL` statutory schedule                    | encrypted parent IBAN, keyed fingerprint, parent confirmation, no Mila custody |
| Private media                  | requested message/memory service                                 | configured retention deadline                            | private bucket, scan, signed URL, parent consent, deletion                     |
| Security/risk signals          | protect users and service                                        | shortest reviewed antifraud window                       | pseudonymized/structured signals, manual review, audit                         |

Optional child data (name, due date, photos) is never required for account creation. Product copy must explain that parents should avoid health, identity, address or other sensitive child data. Final age/parental-authority and child-media language is `BLOCKED_EXTERNAL`.

## Consent and cookies

Necessary session/CSRF/access cookies are separated from analytics consent. Analytics is denied/unset by default and sends no event before opt-in. The browser choice remains editable on `/cookies`; accepted product events carry an affirmative flag and are persisted only under keyed visitor/session pseudonyms. `privacy_consents` remains the account-level evidence store for versioned policy decisions, separate from anonymous audience measurement.

## Rights workflow

Authentication-protected profile APIs provide access/correction, JSON export and account deletion. Staff must verify identity before handling any offline request. Deletion revokes sessions immediately, removes public availability and follows the approved retention exceptions for immutable financial/security records. Requests, decision, export delivery and exceptions must be logged without placing exported personal data in the audit log.

## Processors and transfers

`data_processors` is the authoritative operational register for hosting, MySQL, Redis, object storage, email, payments, captcha, analytics/monitoring and printing providers. Production activation requires a signed processor agreement, region/subprocessor review, security measures, deletion terms and transfer mechanism where applicable. No provider should be marked active based on this repository alone.

## Incident workflow

`security_incidents` records detection, severity, personal-data involvement, response status and notification deadline. The operator must contain and preserve evidence, assess scope/impact, rotate affected credentials, restore safely, document decisions and notify the competent authority/data subjects when qualified review determines this is required. Alert destinations, on-call ownership and the final breach-notification procedure are `BLOCKED_EXTERNAL` until named operators and counsel are supplied.

## Legal and commercial review register

- legal notice: publisher identity, registered address, company/VAT numbers, hosting entity;
- privacy: controller/DPO contact, lawful bases, exact retention schedule, recipients, transfers and complaint authority;
- terms: governing law, liability, moderation/appeal, consumer withdrawal and service termination;
- Premium: final price/tax, benefits, access after partial refund, withdrawal/refund language;
- Rewards/referrals/affiliation: legal nature, expiry, tax/accounting, abuse decisions and disclosure;
- contributions/payments: legal qualification of direct parent transfers, taxation, refunds, fraud and accounting;
- child data/media: parental authority, age, consent, publication and retention;
- partner/printing: contracts, intellectual-property permission, fulfilment and returns.

Until approved text and entity details are provided, legal pages are product drafts and must not be represented as professional legal advice or production-ready terms.
