/** @csl/app-ui — точка сборки вариант×дизайн (ARCHITECTURE §6.2, MATRIX). */
export { AppRoot, findInfo } from './root';
export { registerSW } from './sw';
export { VARIANT_FEATURES, demoTournamentList, MODE_ORDER } from './config';
export type { AppConfig, VariantId, VariantFeatures, DemoTournamentInfo } from './config';
export { TournamentProvider, useTourney, useTourneyStore, useLeaderboard, useDeltaRows, useConnInfo, OptionalConnBadge, useMaybeStore } from './store-context';
export { AppLayout, Crumbs } from './layouts';
