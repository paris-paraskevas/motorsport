# Privacy Policy

_Last updated: 2026-08-22_

This Privacy Policy explains what personal data Paddock Tracker collects, how it is used, who it is shared with, how long it is kept, and the rights you have over it. It applies to https://paddock-tracker.com (the "Site").

Paddock Tracker is operated as a personal project by Paris Paraskevas. Contact: **pparaskevas.dev@gmail.com**.

If you do not agree with this policy, please do not use the Site.

## 1. Who is the data controller

<!-- Address block — preserve the two trailing spaces on each line; they're the markdown hard-break and our pipeline strips raw HTML <br/> tags. -->

For the purposes of the GDPR and equivalent laws, the data controller is:

**Paris Paraskevas**  
Andrea Papandreou 23, Melissokhori  
41500 Larissa  
Greece (EU)

Email: **pparaskevas.dev@gmail.com**

There is no Data Protection Officer; reach out at the contact email. The full operator information is also available on the [Imprint page](/imprint).

## 2. Data we collect

We collect only what is necessary to operate the Site and offer the features you opt into.

### When you visit anonymously
- **Server access logs** managed by our hosting provider (Cloudflare). Includes IP address, user-agent, timestamps, requested URL. Used for operations and abuse prevention. Cloudflare retains these per its own retention policy.
- **Cloudflare Web Analytics**, a page-view and performance measurement script that Cloudflare injects into pages as they pass through its network. It is **cookieless by design**: Cloudflare's documentation states the script stores nothing in your browser and reads no cookies, `localStorage`, `sessionStorage` or IndexedDB, does not log query strings, and discards your IP address at the nearest Cloudflare data centre rather than storing it. It reports page load timings and aggregate figures such as top pages and countries. Because it sets nothing on your device and identifies nobody, it does not appear in the cookie table, but it is a third-party script and we would rather name it than not.
- **Cookies and local storage** as detailed in the [Cookie Policy](/cookies). Non-essential cookies (analytics, advertising) are **denied by default** until you grant consent.

### When you create an account
Authentication is handled by **Clerk**. We do not store your password. Clerk records:
- Email address
- Authentication tokens (cookies on `.clerk.paddock-tracker.com` and `paddock-tracker.com`)
- Session metadata

See Clerk's own privacy policy at https://clerk.com/legal/privacy.

### When you follow series or save preferences
- Lists of followed series, theme choice, notification preferences, and similar settings are stored **in your browser's local storage**. They are not transmitted to our servers unless you have notifications enabled.

### When we ask you to support the site
- Paddock occasionally shows a short note asking whether you would like to support the site. Deciding when to show it needs a rough measure of how long you have been reading, so a counter and the note's own state are kept in your browser's **session storage** (the `paddock:support-prompt` key). Session storage is cleared when you close the tab and none of it reaches our servers.
- If you are signed in and choose **Don't show this again**, that preference is saved to your account metadata at Clerk so the note stays hidden on every device. Signed out, the choice lasts for the visit only, because there is nowhere else to keep it.
- We cannot tell whether you have actually donated: payments are handled by Buy Me a Coffee, which does not report back to us.

### When you enable push notifications
- Your push subscription endpoint (a URL pointing to your browser's push service) and cryptographic keys are stored in our key-value store (Upstash Redis) so we can send race notifications. Tied to your account if you are signed in, otherwise to a random identifier. Removed when you disable notifications.
- If you are signed in, we also keep a short list of the notifications actually sent to you, so the app can show you what arrived. It holds the notification's own title, body and link, nothing else.

### When you submit the contact form
- Email address (if you provide one), message body, optional category. Kept for 12 months in our key-value store (Upstash Redis) and delivered to the operator's inbox via Resend.

### When you use the site (anonymous interaction measurement)
- If, and only if, you grant **analytics** consent, we record anonymous interaction events for the page you are on: which tagged elements were clicked or scrolled past, how far down the page you reached, and clicks that landed on nothing. Each event carries a position within an element, your viewport size and a coarse device class. **No cookies, no identifiers and nothing that could identify you** are involved, the batch is the only thing that leaves your browser, and we also honour the browser's Do Not Track signal by recording nothing at all. The events are stored in our Supabase database and are used to see which parts of a page people actually use.

### When you use the in-app assistant
- **The in-app assistant is currently switched off** and is not reachable from any page. This clause describes what happens if it returns, and nothing here is being collected while it is off.
- If you open the in-app help assistant ("Race Engineer") and send a question, the text of your question and the recent messages in that chat are sent to **Google** (the Gemini API) to generate a reply. Please don't include sensitive personal information in your questions. The assistant is grounded in our own help content and does not receive your account data. See Google's terms at https://ai.google.dev/gemini-api/terms. We also keep a limited, recent history of assistant questions (and any 👍/👎 rating you give) to see which questions are common and improve the assistant — a capped recent log, not indefinite retention, used only for that purpose.

### When you give cookie consent
- Your consent decision is stored **in your own browser**, under the `paddock:consent` key in `localStorage`, together with the date you made it. It is our own consent modal, not a third-party platform, and **we keep no consent log on any server**. Clearing your browser storage simply means we ask again on your next visit, and we re-ask automatically after 12 months so the decision stays current.

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
| **Cloudflare** | Hosting, server logs (IP, user-agent, requested URL), object storage, cookieless page-view and performance measurement | Hosting and infrastructure; Web Analytics; also bot mitigation on Clerk-served pages |
| **Upstash** | Push subscriptions, contact-form records, cached upstream data | Our key-value store |
| **Supabase** | Account-linked app data (blog, submissions, predictions), anonymous interaction events | Our application database |
| **Clerk** | Email, authentication data, IP, user-agent | Authentication |
| **Google Analytics** | Anonymised usage events, cookies | Aggregate analytics (only if you grant analytics consent) |
| **Google AdSense** | Ad-serving requests, cookies | Advertising (only if you grant marketing consent) |
| **Resend** | Email address, message body (if you use the contact form) | Email delivery |
| **Google (Gemini API)** | The text of your assistant questions | Generating in-app assistant replies (only if you use the assistant) |
| **Open-Meteo, Wikipedia, jolpica** | Pseudonymous request metadata | Public-data fetches for weather/championship info |

Each of these third parties has its own privacy policy and acts as an independent or sub-processor depending on the integration.

## 5. International data transfers

Several of the providers above are US-based or operate globally: **Clerk**, **Google**, **Resend** and **Upstash** process data in the United States, and **Cloudflare** serves the Site from a global network, which means a request is handled by whichever of its locations is nearest to you. Where processing happens outside the EEA, transfers rely on the **EU Standard Contractual Clauses** and the equivalent UK and Swiss mechanisms operated by those providers.

## 6. How long we keep it

| Data | Retention |
|---|---|
| Server access logs | Per Cloudflare's own retention |
| Account data | Until you delete the account |
| Push subscriptions | Until you disable notifications |
| Sent-notification list (signed in) | The most recent notifications only, then rolled off |
| Contact-form submissions | 12 months in our key-value store; emails kept per the operator's inbox |
| Anonymous interaction events | Aggregate measurement, not tied to you or to any identifier |
| Cookie consent record | In your browser only, until you clear it; re-asked after 12 months |
| Local-storage preferences | Until you clear browser storage |
| Support-note reading counter (`paddock:support-prompt`) | Until you close the tab |
| Signed-in "don't show the support note again" flag | Until you clear it from your account |

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

## 8. Cookie consent

On your first visit we show **our own consent modal**, with four categories: Necessary (always on), Analytics, Advertising and Functional. The three optional ones are **off by default everywhere**, not only in the EEA, UK and Switzerland, and nothing non-essential runs until you opt in.

You can change your mind at any time through the **Manage cookies** link in the footer, which re-opens the same modal. Whatever you choose is applied immediately site-wide via **Google Consent Mode v2**.

If your browser sends a **Global Privacy Control** signal, we honour it: analytics and advertising stay off whatever the modal says, on every visit, and the modal tells you that is what is happening. The [Cookie Policy](/cookies) lists every cookie and storage key involved.

## 9. Children

Paddock Tracker is not directed at children under 13 (or 16 in some jurisdictions). We do not knowingly collect data from children. If you believe a child has provided us data, contact us and we will delete it.

## 10. Security

We use industry-standard transport encryption (HTTPS with HSTS, including a preload directive), Cloudflare's platform-level security, a Content Security Policy, and rely on Clerk for authentication best practices. No system is perfectly secure — if you believe you have found a vulnerability, please contact us.

## 11. Changes to this policy

We may update this policy from time to time. The "Last updated" date at the top reflects the most recent change. Material changes will be announced in the [release notes](/changelog).

## 12. Contact

For any privacy question or to exercise your rights:

**pparaskevas.dev@gmail.com**
