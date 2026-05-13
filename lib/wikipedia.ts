import { WikipediaSummary } from './types';

const SUMMARY_ENDPOINT = 'https://en.wikipedia.org/api/rest_v1/page/summary/';

interface WikipediaSummaryResponse {
  title?: string;
  extract?: string;
  description?: string;
  content_urls?: {
    desktop?: { page?: string };
  };
}

export async function fetchWikipediaSummary(
  pageTitle: string,
): Promise<WikipediaSummary | null> {
  try {
    const res = await fetch(
      `${SUMMARY_ENDPOINT}${encodeURIComponent(pageTitle)}`,
      { next: { revalidate: 86400 } } as RequestInit,
    );
    if (!res.ok) return null;

    const data = (await res.json()) as WikipediaSummaryResponse;
    if (!data || !data.extract || !data.title) return null;

    const url = data.content_urls?.desktop?.page;
    if (!url) return null;

    return {
      title: data.title,
      extract: data.extract,
      description: data.description,
      url,
      fetchedAt: new Date(),
    };
  } catch {
    return null;
  }
}
