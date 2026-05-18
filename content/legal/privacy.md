# Privacy Policy

_Last updated: 2026-05-19_

This Privacy Policy explains what personal data Paddock collects, how it is used, who it is shared with, how long it is kept, and the rights you have over it. It applies to https://paddock-tracker.com (the "Site").

Paddock is operated as a personal project by Paris Paraskevas. Contact: **pparaskevas.dev@gmail.com**.

If you do not agree with this policy, please do not use the Site.

## 1. Who is the data controller

For the purposes of the GDPR and equivalent laws, the data controller is the operator of Paddock listed above, based in **Greece (EU)**. There is no Data Protection Officer; reach out at the contact email.

## 2. Data we collect

We collect only what is necessary to operate the Site and offer the features you opt into.

### When you visit anonymously
- **Server access logs** managed by our hosting provider (Vercel). Includes IP address, user-agent, timestamps, requested URL. Used for operations and abuse prevention. Vercel retains these per its own retention policy.
- **Cookies and local storage** as detailed in the [Cookie Policy](/cookies). Non-essential cookies (analytics, advertising) are **denied by default** until you grant consent.

### When you create an account
Authentication is handled by **Clerk**. We do not store your password. Clerk records:
- Email address
- Authentication tokens (cookies on `.clerk.paddock-tracker.com` and `paddock-tracker.com`)
- Session metadata

See Clerk's own privacy policy at https://clerk.com/legal/privacy.

### When you follow series or save preferences
- Lists of followed series, theme choice, notification preferences, and similar settings are stored **in your browser's local storage**. They are not transmitted to our servers unless you have notifications enabled.

### When you enable push notifications
- Your push subscription endpoint (a URL pointing to your browser's push service) and cryptographic keys are stored in Vercel KV so we can send race notifications. Tied to your account if you are signed in, otherwise to a random identifier. Removed when you disable notifications.

### When you submit the contact form
- Email address (if you provide one), message body, optional category. Stored short-term in Vercel KV and delivered to the operator inbox via Resend.

### When you give cookie consent
- A consent record (timestamp, categories chosen, consent version, anonymous identifier) is stored both in your browser's local storage and on our server (Vercel KV) so we can demonstrate compliance. Retained for **24 months** then deleted.

## 3. Why we collect it (lawful basis under GDPR)

| Purpose | Lawful basis |
|---|---|
| Operating the Site, security, abuse prevention | Legitimate interests |
| Account, authentication, sessions | Performance of a contract (your use of the account features) |
| Storing your preferences (local storage) | Strictly necessary for service you requested |
| Sending push notifications | Consent + performance of the feature you opted into |
| Sending contact-form replies | Consent + legitimate interests (responding to your request) |
| Analytics (Google Analytics) | Consent |
| Advertising (Google AdSense) | Consent |
| Consent record keeping | Legal obligation (GDPR Article 7(1)) |

## 4. Who we share data with

We do not sell personal data. We share data with the following service providers strictly to operate the Site:

| Recipient | What they receive | Why |
|---|---|---|
| **Vercel** | Hosting, server logs, KV data | Hosting and infrastructure |
| **Clerk** | Email, authentication data, IP, user-agent | Authentication |
| **Cloudflare** (via Clerk) | IP, user-agent | Bot mitigation on Clerk-served pages |
| **Google Analytics** | Anonymised usage events, cookies | Aggregate analytics (only if you grant analytics consent) |
| **Google AdSense** | Ad-serving requests, cookies | Advertising (only if you grant marketing consent) |
| **Resend** | Email address, message body (if you use the contact form) | Email delivery |
| **Open-Meteo, Wikipedia, jolpica** | Pseudonymous request metadata | Public-data fetches for weather/championship info |

Each of these third parties has its own privacy policy and acts as an independent or sub-processor depending on the integration.

## 5. International data transfers

Vercel and Google process data in the United States. Clerk processes data in the United States. Transfers rely on the **EU Standard Contractual Clauses** and equivalent UK/Swiss mechanisms used by these providers.

## 6. How long we keep it

| Data | Retention |
|---|---|
| Server access logs | Per Vercel's retention (≈30 days) |
| Account data | Until you delete the account |
| Push subscriptions | Until you disable notifications |
| Contact-form submissions | 12 months in KV; emails kept per your inbox |
| Cookie consent record | 24 months |
| Local-storage preferences | Until you clear browser storage |

## 7. Your rights

If you are in the EEA, UK, Switzerland, or California you have, among others, the right to:
- **Access** the personal data we hold about you
- **Rectify** inaccurate data
- **Erase** ("right to be forgotten")
- **Restrict** or **object to** certain processing
- **Withdraw consent** at any time (this does not affect lawfulness of past processing)
- **Data portability** for data processed under contract or consent
- **Lodge a complaint** with your supervisory authority. In Greece the supervisory authority is the **Hellenic Data Protection Authority (HDPA)** — https://www.dpa.gr/en. EU residents in other countries can complain to their own national DPA.

Californian residents additionally have rights under the **CCPA/CPRA**, including the right to know what categories of personal information we collect, to delete it, to opt out of "sale" or "sharing" (we don't sell, but ad-tech sharing falls under CCPA's definition — use the [Do Not Sell or Share](/do-not-sell) page to opt out), and to limit use of sensitive personal information.

To exercise any of these rights, email **pparaskevas.dev@gmail.com** with the request. We will respond within 30 days.

## 8. Global Privacy Control (GPC)

If your browser sends the **Global Privacy Control** signal, we treat it as a request to opt out of advertising/analytics tracking — equivalent to choosing "Reject non-essential" in our cookie banner. You don't need to do anything extra.

## 9. Children

Paddock is not directed at children under 13 (or 16 in some jurisdictions). We do not knowingly collect data from children. If you believe a child has provided us data, contact us and we will delete it.

## 10. Security

We use industry-standard transport encryption (HTTPS), Vercel's platform-level security, and rely on Clerk for authentication best practices. No system is perfectly secure — if you believe you have found a vulnerability, please contact us.

## 11. Changes to this policy

We may update this policy from time to time. The "Last updated" date at the top reflects the most recent change. Material changes will be announced in the [release notes](/changelog).

## 12. Contact

For any privacy question or to exercise your rights:

**pparaskevas.dev@gmail.com**

<!-- TODO confirm: jurisdiction is Greece (Thessaloniki courts) — change if needed. Email is pparaskevas.dev@gmail.com — change if needed. -->
