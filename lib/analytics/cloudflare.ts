// Cloudflare usage and cost for the console's System tab.
//
// Two separate tokens on purpose, and they are not interchangeable:
//   CLOUDFLARE_ANALYTICS_TOKEN — Account → Account Analytics → Read
//   CLOUDFLARE_BILLING_TOKEN   — Account → Billing → Read
// Billing is the most sensitive permission here, so it lives on its own token
// and can be revoked without taking the usage panel down with it.
//
// Both plain `fetch`. No SDK, for the reason lib/analytics/google-auth.ts
// explains at length.

const GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql';
const REST = 'https://api.cloudflare.com/client/v4';

/**
 * Workers Paid includes 10 million requests a month, then $0.30 per additional
 * million (Cloudflare Workers pricing, checked 2026-08-27).
 *
 * Hard-coded because no API reports your plan's allowance, and shown as a
 * reference line rather than used to compute anything — if the plan changes,
 * a wrong reference is visibly wrong, whereas a wrong derived figure is not.
 */
export const WORKERS_INCLUDED_REQUESTS = 10_000_000;

export interface WorkerUsage {
  requests: number;
  errors: number;
  subrequests: number;
  days: number;
}

export interface BillableUsage {
  currency: string;
  periodStart: string | null;
  /** Summed per service, largest cost first. */
  services: { name: string; quantity: number; unit: string; cost: number }[];
  total: number;
}

export function isCloudflareUsageConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_ANALYTICS_TOKEN);
}

export function isCloudflareBillingConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_BILLING_TOKEN);
}

interface GraphQLResponse {
  errors?: { message: string }[];
  data?: {
    viewer?: {
      accounts?: { workersInvocationsAdaptive?: { sum?: { requests?: number; errors?: number; subrequests?: number } }[] }[];
    };
  };
}

/**
 * Worker request volume over `days`.
 *
 * Deliberately limited to requests / errors / subrequests — the three fields
 * proven against the live API before this shipped. The dataset also exposes
 * CPU-time quantiles, but GraphQL fails the WHOLE query on one unknown field,
 * so an unverified addition here would blank the panel rather than degrade it.
 *
 * The API serves at most a month, and only back three months.
 */
export async function fetchWorkerUsage(days = 30): Promise<WorkerUsage | null> {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_ANALYTICS_TOKEN;
  if (!account || !token) return null;

  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const query = `query($tag:string!,$start:string!,$end:string!){
    viewer { accounts(filter:{accountTag:$tag}) {
      workersInvocationsAdaptive(limit:100, filter:{datetime_geq:$start, datetime_leq:$end}) {
        sum { requests errors subrequests }
      }
    }}
  }`;

  try {
    const res = await fetch(GRAPHQL, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { tag: account, start: start.toISOString(), end: end.toISOString() },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as GraphQLResponse;
    // GraphQL answers 200 with an `errors` array — a permission problem looks
    // like success to a status check.
    if (data.errors?.length) return null;
    const rows = data.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? [];
    return {
      requests: rows.reduce((n, r) => n + (r.sum?.requests ?? 0), 0),
      errors: rows.reduce((n, r) => n + (r.sum?.errors ?? 0), 0),
      subrequests: rows.reduce((n, r) => n + (r.sum?.subrequests ?? 0), 0),
      days,
    };
  } catch {
    return null;
  }
}

interface BillableRow {
  ServiceName?: string;
  ConsumedQuantity?: number | string;
  ConsumedUnit?: string;
  ContractedCost?: number | string;
  BillingCurrency?: string;
  BillingPeriodStart?: string;
}

/**
 * Usage-based charges for the current period, grouped by service.
 *
 * IMPORTANT, and the panel says so out loud: this endpoint returns **usage-based
 * charges only**. Fixed plan subscriptions are not in it — so the Workers Paid
 * $5/month base does NOT appear here, and presenting this total as "what the
 * site costs" would understate the bill by most of it. Verified against the live
 * account before shipping: the only rows returned were R2 storage and
 * operations.
 *
 * Self-serve accounts only; Enterprise contracts are not supported and return
 * an error, which lands as null and a "not available" state.
 */
export async function fetchBillableUsage(days = 30): Promise<BillableUsage | null> {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_BILLING_TOKEN;
  if (!account || !token) return null;

  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  try {
    const res = await fetch(`${REST}/accounts/${account}/billable-usage?from=${from}&to=${to}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { success?: boolean; result?: BillableRow[] };
    if (data.success === false || !Array.isArray(data.result)) return null;

    const grouped = new Map<string, { quantity: number; unit: string; cost: number }>();
    let currency = 'USD';
    let periodStart: string | null = null;

    for (const row of data.result) {
      const name = row.ServiceName;
      if (!name) continue;
      if (row.BillingCurrency) currency = row.BillingCurrency;
      if (!periodStart && row.BillingPeriodStart) periodStart = row.BillingPeriodStart;
      const prev = grouped.get(name) ?? { quantity: 0, unit: row.ConsumedUnit ?? '', cost: 0 };
      grouped.set(name, {
        quantity: prev.quantity + (Number(row.ConsumedQuantity) || 0),
        unit: prev.unit || (row.ConsumedUnit ?? ''),
        cost: prev.cost + (Number(row.ContractedCost) || 0),
      });
    }

    const services = [...grouped.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.cost - a.cost || b.quantity - a.quantity);

    return {
      currency,
      periodStart,
      services,
      total: services.reduce((n, s) => n + s.cost, 0),
    };
  } catch {
    return null;
  }
}
