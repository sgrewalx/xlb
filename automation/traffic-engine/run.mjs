import { writeJsonIfChanged } from "../shared/content-writer.mjs";
import {
  buildAutonomyState,
  buildExperimentLedger,
  buildGalleryCollections,
  buildGamesCatalog,
  buildHomeModules,
  buildPruneReport,
  buildSignalReport,
  buildSurfaceRankingReport,
  buildVideoShorts,
  loadTrafficEngineContext,
} from "./shared.mjs";

const HOME_MODULES_FILE = new URL("../../public/content/home/modules.json", import.meta.url);
const VIDEO_SHORTS_FILE = new URL("../../public/content/video/shorts.json", import.meta.url);
const GAMES_CATALOG_FILE = new URL("../../public/content/games/catalog.json", import.meta.url);
const GALLERY_COLLECTIONS_FILE = new URL("../../public/content/gallery/collections.json", import.meta.url);

const SIGNAL_REPORT_FILE = new URL("../../automation/reports/signal-agent.json", import.meta.url);
const SURFACE_RANKER_FILE = new URL("../../automation/reports/surface-ranker.json", import.meta.url);
const VIDEO_AGENT_FILE = new URL("../../automation/reports/video-agent.json", import.meta.url);
const HOMEPAGE_AGENT_FILE = new URL("../../automation/reports/homepage-agent.json", import.meta.url);
const RETENTION_AGENT_FILE = new URL("../../automation/reports/retention-agent.json", import.meta.url);
const PRUNE_AGENT_FILE = new URL("../../automation/reports/prune-agent.json", import.meta.url);
const AUTONOMY_STATE_FILE = new URL("../../automation/reports/autonomy-state.json", import.meta.url);
const EXPERIMENT_LEDGER_FILE = new URL("../../automation/experiments/surface-ledger.json", import.meta.url);

async function main() {
  const context = await loadTrafficEngineContext();
  const homeModules = buildHomeModules(context);
  const videoShorts = buildVideoShorts(context);
  const gamesCatalog = buildGamesCatalog(context);
  const galleryCollections = buildGalleryCollections(context);
  const signalReport = buildSignalReport(context);
  const surfaceReport = buildSurfaceRankingReport(
    context,
    homeModules,
    videoShorts,
    gamesCatalog,
    galleryCollections,
  );
  const pruneReport = buildPruneReport(context);
  const autonomyState = buildAutonomyState(
    context,
    homeModules,
    videoShorts,
    gamesCatalog,
    galleryCollections,
  );
  const experimentLedger = buildExperimentLedger(
    context,
    homeModules,
    videoShorts,
    gamesCatalog,
    galleryCollections,
  );

  await Promise.all([
    writeAndLog(HOME_MODULES_FILE, homeModules),
    writeAndLog(VIDEO_SHORTS_FILE, videoShorts),
    writeAndLog(GAMES_CATALOG_FILE, gamesCatalog),
    writeAndLog(GALLERY_COLLECTIONS_FILE, galleryCollections),
    writeAndLog(SIGNAL_REPORT_FILE, signalReport),
    writeAndLog(SURFACE_RANKER_FILE, surfaceReport),
    writeAndLog(VIDEO_AGENT_FILE, {
      updatedAt: context.updatedAt,
      selectedCount: videoShorts.items.length,
      topRetentionScore: videoShorts.items[0]?.retentionScore ?? 0,
      relatedPaths: [...new Set(videoShorts.items.map((item) => item.relatedPath))],
    }),
    writeAndLog(HOMEPAGE_AGENT_FILE, {
      updatedAt: context.updatedAt,
      moduleOrder: homeModules.items.map((item) => item.id),
      itemCounts: homeModules.items.map((item) => ({
        id: item.id,
        items: item.items.length,
      })),
    }),
    writeAndLog(RETENTION_AGENT_FILE, {
      updatedAt: context.updatedAt,
      games: gamesCatalog.items.map((item) => ({
        id: item.id,
        featured: item.featured,
        relatedPath: item.relatedPath,
      })),
      gallery: galleryCollections.items.map((item) => ({
        id: item.id,
        category: item.category,
        entries: item.entries.length,
      })),
    }),
    writeAndLog(PRUNE_AGENT_FILE, pruneReport),
    writeAndLog(AUTONOMY_STATE_FILE, autonomyState),
    writeAndLog(EXPERIMENT_LEDGER_FILE, experimentLedger),
  ]);
}

async function writeAndLog(fileUrl, data) {
  const changed = await writeJsonIfChanged(fileUrl, data);
  const pathLabel = fileUrl.pathname.split("/home/x9/cmt7/xlb/").at(-1) ?? fileUrl.pathname;
  console.log(changed ? `Updated ${pathLabel}` : `${pathLabel} already matched generated output`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
