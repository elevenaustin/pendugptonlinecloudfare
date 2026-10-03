/**
 * Minimal analytics dispatcher. Connect a provider (GA4, PostHog, Meta Pixel)
 * inside `track` later. No personal data should be sent as event props.
 */
type Props = Record<string, string | number | boolean | undefined>;

export function track(event: string, props: Props = {}) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({ event, ...props });
}
