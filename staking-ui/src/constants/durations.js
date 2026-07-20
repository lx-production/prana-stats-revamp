/**
 * Display labels for the legacy DurationSlider only.
 * APR / duration list for the new /stake/ UI comes from backend/on-chain — do not
 * treat this as protocol config. Removed with staking-ui in step 7.
 */
import { SECONDS_PER_DAY } from '../../../constants/network.ts'

export const DURATION_OPTIONS = [1, 7, 30, 90, 180, 365].map((days) => ({
  days,
  label: `${days} ngày`,
  seconds: days * SECONDS_PER_DAY,
}))
