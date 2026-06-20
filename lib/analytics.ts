import { track } from '@vercel/analytics'

type AnalyticsEvents = {
  login: { company: string }
  parade_state_generated: { company: string; soldierCount: number; date: string }
}

export function trackEvent<K extends keyof AnalyticsEvents>(name: K, props: AnalyticsEvents[K]): void {
  track(name, props)
}
