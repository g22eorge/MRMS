/**
 * Documents alias for the shared {@link RecordSummaryRail}. Kept so existing
 * `@/components/documents/DocumentSummaryRail` imports resolve unchanged; new code
 * outside the documents module should import from `@/components/record`.
 */
export {
  RecordSummaryRail as DocumentSummaryRail,
  type SummaryRow,
  type RelatedDoc,
  type ActivityItem,
  type PartyBlock,
  type ClientBlock,
} from "@/components/record/RecordSummaryRail";
