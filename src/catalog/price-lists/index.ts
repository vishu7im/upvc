// =====================================================================
// price-lists/index.ts — the transcribed Sunny Plast price lists.
//
// GOLDEN RULE: every number in the doc-*.ts files is a verbatim transcription
// of a real PDF in docs/price_list/ with a per-line source citation. The import
// script (src/tools/import-prices.ts) is the only consumer.
// =====================================================================

import type { PriceDoc } from "./types.ts";
import { DOC_A } from "./doc-a-profiles-anglia-2025-04-25.ts";
import { DOC_B } from "./doc-b-cills-per-length.ts";
import { DOC_C } from "./doc-c-panels.ts";
import { DOC_D } from "./doc-d-sliding-2025-07-29.ts";

export { PRICE_MAPPINGS } from "./mapping.ts";
export * from "./types.ts";

export const ALL_PRICE_DOCS: PriceDoc[] = [DOC_A, DOC_B, DOC_C, DOC_D];
