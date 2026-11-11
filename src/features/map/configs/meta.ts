import { DATASETS } from "@/config/datasets";

/**
 * Legend and metadata control synced with overlay visibility.
 * Lightweight metadata per supported overlay. Sources align with existing config/docs.
 */
const META = {
  faults: {
    label: 'Faults',
    source: 'GEM Global Active Faults (harmonized)',
    // Use centralized dataset URL (jsDelivr GitHub) for exact ref
    lastUpdateHintUrl: DATASETS.FAULTS.sourceUrl,
  },
  plates: {
    label: 'Plate Boundaries',
    source: 'PB2002 (Bird, 2003) via tectonicplates',
    lastUpdateHintUrl: DATASETS.PLATES.sourceUrl,
  },
  par: {
    label: 'PAR Boundary',
    source: 'PAGASA Philippine Area of Responsibility',
  },
  // Population overlay removed
};

export default META;