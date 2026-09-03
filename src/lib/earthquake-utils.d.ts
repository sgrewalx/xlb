import type { EarthquakeEvent } from "../types/content";

export const EARTHQUAKE_VISIT_KEY: string;
export type EarthquakeFilter = "all" | "m4" | "m5";
export type EarthquakeSort = "newest" | "magnitude" | "depth";
export interface EarthquakeVisit { visitedAt: string; eventIds: string[] }
export interface EarthquakeReturnDelta {
  previousVisitAt: string;
  newCount: number;
  newM4Plus: number;
  strongestNew: EarthquakeEvent | null;
}
export interface EarthquakeVisitMeasurement {
  delta: EarthquakeReturnDelta | null;
  shouldTrack: boolean;
  didPersist: boolean;
}
export interface EarthquakeVisitSession {
  priorVisitAtMount: EarthquakeVisit | null;
  recordManifest(events: EarthquakeEvent[]): EarthquakeVisitMeasurement;
}
export function filterAndSortEarthquakes(events: EarthquakeEvent[], filter: EarthquakeFilter, sort: EarthquakeSort): EarthquakeEvent[];
export function computeEarthquakeReturnDelta(events: EarthquakeEvent[], previousVisit: EarthquakeVisit | null): EarthquakeReturnDelta | null;
export function readEarthquakeVisit(storage: Pick<Storage, "getItem">, key?: string): EarthquakeVisit | null;
export function writeEarthquakeVisit(storage: Pick<Storage, "setItem">, updatedAt: string, events: EarthquakeEvent[], key?: string): void;
export function createEarthquakeVisitSession(
  storage: Pick<Storage, "getItem" | "setItem">,
  options?: { key?: string; mountedAt?: string },
): EarthquakeVisitSession;
