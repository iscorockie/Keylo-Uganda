# KeyLo signal and payment integration plan

## Provider boundary

All external data flows through provider adapters that normalize into `external_risk_signals`. The scoring engine never calls a provider directly. This lets an organization use gnuGrid, another licensed CRB, or an internal SACCO feed without changing the model.

```text
consent capture -> provider request -> normalized signal -> immutable score snapshot
                                         |
                             provider reference + expiry
```

### Credit and loan signals

- **gnuGrid CRB:** primary provider candidate for Mobile Credit Score and Universal Loan Checker. Request only after explicit, purpose-specific consent. Store the normalized score, flags, provider reference and expiry; encrypt any raw response and keep it out of the UI.
- **SACCO / MFI history:** ingest a normalized repayment summary (on-time ratio, active balance, arrears days, reporting period) through CSV first, then a partner API. Do not let a partner upload raw account statements into the browser.
- **Future providers:** use the same adapter contract: `getSignals({ phone, ninHash, consentId })` returns normalized signals and a traceable provider reference.

### Payments

- **MTN MoMo:** use Collections / Request to Pay for subscription fees and deposits; Transfer for refunds or residual-value payouts. Use OAuth credentials only server-side, and confirm final states through webhook + transaction-status lookup.
- **Airtel Money:** use collection and disbursement endpoints with the same server-side adapter. Normalize MSISDN to Uganda `256...` format before dispatch.
- Payment callbacks must be idempotent using `(provider, external_reference)`. Never treat a client redirect as payment confirmation.

## Consent and compliance controls

The intake UI now captures a required consent acknowledgement. Production should replace this with a versioned disclosure containing: data categories, providers, purpose, retention period, contact/complaint path, and withdrawal method. Persist it in `data_consents` with the exact displayed text and actor.

Before production launch:

1. Verify provider licensing, commercial access and data-processing agreements.
2. Confirm PDPO registration/processor duties and the applicable UMRA / Bank of Uganda digital lending requirements with Ugandan counsel.
3. Separate payment credentials from underwriting credentials; use a secrets manager and rotate keys.
4. Add webhook signature verification, replay protection, rate limits and provider outage fallbacks.
5. Log every signal used in a decision, including consent id, provider reference, retrieval time and model version.

## Initial adapter interface

```ts
type SignalRequest = { phone: string; ninHash?: string; consentId: string };
type NormalizedSignals = {
  mobileCreditScore?: number;
  activeDigitalLoans?: number;
  crbStatus?: 'CLEAR' | 'FLAGGED' | 'UNKNOWN';
  source: string;
  providerReference: string;
  expiresAt?: string;
};
```

The current UI uses representative values only. No provider credentials or live calls are included in this MVP.
