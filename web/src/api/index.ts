/**
 * Публичный API-слой приложения.
 */

export { apiClient } from "./client";
export { tokenStorage } from "./tokenStorage";
export { login, logout, fetchMe } from "./auth";

export {
    CONTAINER_STATUS_LABELS,
    bulkCreateContainers,
    deleteContainer,
    downloadLabelPdf,
    fetchContainer,
    fetchContainers,
    fetchLabelPdfUrl,
    fillContainerWithSamples,
    updateContainer,
    useBulkCreateContainers,
    useContainer,
    useContainers,
    useDeleteContainer,
    useFillSamples,
    useUpdateContainer,
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
    UpdateContainerPayload,
} from "./containers";

export { fetchContainerTypes, useContainerTypes } from "./containerTypes";
export type { ContainerType } from "./containerTypes";

export {
    SAMPLE_STATUS_LABELS,
    deleteSample,
    disposeSample,
    fetchSample,
    fetchSamples,
    fetchSamplesGrouped,
    restoreSample,
    updateSample,
    useDeleteSample,
    useDisposeSample,
    useRestoreSample,
    useSample,
    useSamples,
    useSamplesGrouped,
    useUpdateSample,
} from "./samples";
export type {
    GroupedContainer,
    GroupedContainerBrief,
    GroupedResearchType,
    GroupedSampleBrief,
    GroupedWorkOrder,
    Sample,
    SampleFilters,
    SampleGroup,
    SampleStatus,
    SamplesGroupedParams,
    SamplesGroupedResponse,
    SamplesListParams,
    UpdateSamplePayload,
} from "./samples";

export {
    CATALOG_META,
    useCreateCatalog,
    useDeleteCatalog,
    useLaboratories,
    useResearchTypes,
    useSites,
    useUpdateCatalog,
} from "./catalogs";
export type {
    CatalogKind,
    CatalogPayload,
    Laboratory,
    ResearchType,
    Site,
} from "./catalogs";

// Топология склада (2f-4a).
export {
    CELL_TYPE_LABELS,
    useCells,
    useCreateCell,
    useCreateRack,
    useCreateRoom,
    useCreateSection,
    useCreateTier,
    useDeleteCell,
    useDeleteRack,
    useDeleteRoom,
    useDeleteSection,
    useDeleteTier,
    useRacks,
    useRooms,
    useSections,
    useTiers,
    useUpdateCell,
    useUpdateRack,
    useUpdateRoom,
    useUpdateSection,
    useUpdateTier,
} from "./topology";
export type {
    Cell,
    CellPayload,
    CellType,
    Rack,
    RackPayload,
    Room,
    RoomPayload,
    Section,
    SectionPayload,
    Tier,
    TierCode,
    TierPayload,
} from "./topology";

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
    fetchReceiptActBlob,
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