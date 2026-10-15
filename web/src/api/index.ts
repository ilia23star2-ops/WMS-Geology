/**
 * Публичный API-слой приложения.
 */

export { apiClient } from "./client";
export { tokenStorage } from "./tokenStorage";
export { login, logout, fetchMe } from "./auth";

export {
    CONTAINER_STATUS_LABELS,
    bulkCreateContainers,
    downloadLabelPdf,
    fetchContainer,
    fetchContainers,
    fetchLabelPdfUrl,
    fillContainerWithSamples,
    useBulkCreateContainers,
    useContainer,
    useContainers,
    useFillSamples,
} from "./containers";
export type {
    BulkCreateContainerItem,
    BulkCreateContainersRequest,
    BulkCreateContainersResponse,
    Container,
    ContainerFilters,
    ContainerStatus,
    ContainersListParams,
    FillSamplesGroup,
    FillSamplesRequest,
    FillSamplesResponse,
} from "./containers";

export { fetchContainerTypes, useContainerTypes } from "./containerTypes";
export type { ContainerType } from "./containerTypes";

export {
    SAMPLE_STATUS_LABELS,
    fetchSamples,
    useSamples,
} from "./samples";
export type {
    Sample,
    SampleFilters,
    SampleStatus,
    SamplesListParams,
} from "./samples";

export {
    useLaboratories,
    useResearchTypes,
    useSites,
} from "./catalogs";
export type { Laboratory, ResearchType, Site } from "./catalogs";

export {
    PRINT_BATCH_STATUS_LABELS,
    PRINT_TYPE_LABELS,
    downloadBatchPdf,
    fetchPrintBatch,
    fetchPrintBatches,
    useAddContainers,
    useCancelBatch,
    useCreatePrintBatch,
    useMarkPrinted,
    useMarkReady,
    usePrintBatch,
    usePrintBatches,
    useRemoveContainer,
} from "./printBatches";
export type {
    PrintBatch,
    PrintBatchItem,
    PrintBatchStatus,
    PrintBatchesListParams,
    PrintType,
} from "./printBatches";

// Рейсы и приёмка.
export {
    SHIPMENT_DIRECTION_LABELS,
    SHIPMENT_STATUS_LABELS,
    fetchShipment,
    fetchShipments,
    useShipment,
    useShipments,
} from "./shipments";
export type {
    Shipment,
    ShipmentDirection,
    ShipmentFilters,
    ShipmentsListParams,
    ShipmentStatus,
} from "./shipments";

export {
    RECEIPT_ITEM_STATUS_LABELS,
    RECEIPT_STATUS_LABELS,
    checkReceipt,
    completeReceipt,
    fetchReceipt,
    fetchReceiptConflicts,
    fetchReceiptItems,
    fetchReceipts,
    resolveConflicts,
    useCheckReceipt,
    useCompleteReceipt,
    useReceipt,
    useReceiptConflicts,
    useReceiptItems,
    useReceipts,
    useResolveConflicts,
} from "./receipts";
export type {
    CheckReceiptItem,
    CheckReceiptRequest,
    CheckReceiptResponse,
    CompleteReceiptResponse,
    ConflictReason,
    ConflictResolution,
    Receipt,
    ReceiptConflict,
    ReceiptConflictsResponse,
    ReceiptFilters,
    ReceiptItem,
    ReceiptItemStatus,
    ReceiptItemsListParams,
    ReceiptStatus,
    ReceiptsListParams,
    ResolveConflictsRequest,
    ResolveConflictsResponse,
} from "./receipts";

export {
    fetchImportSessionsByReceipt,
    importShipment,
    resolveQuestions,
    useImportSessionByReceipt,
    useImportShipment,
    useResolveQuestions,
} from "./importSessions";
export type {
    ImportError,
    ImportQuestion,
    ImportQuestionReason,
    ImportSession,
    ImportSessionStatus,
    ImportShipmentRequest,
    ImportShipmentResponse,
    ResolveDistributionItem,
    ResolveQuestionItem,
    ResolveQuestionsRequest,
    ResolveQuestionsResponse,
} from "./importSessions";

export type {
    ApiError,
    LoginPayload,
    LoginResponse,
    PaginatedResponse,
    RefreshResponse,
    User,
} from "./types";