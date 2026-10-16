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

// Топология склада (2f-4a + 2f-4b + 2f-4c-2).
export {
    CELL_TYPE_LABELS,
    PALLET_STATUS_LABELS,
    PALLET_TYPE_LABELS,
    downloadCellQrPdf,
    downloadCellsBatchQrPdf,
    downloadSectionQrPdf,
    useCells,
    useCreateCell,
    useCreatePallet,
    useCreateRack,
    useCreateRoom,
    useCreateSection,
    useCreateTier,
    useDeleteCell,
    useDeletePallet,
    useDeleteRack,
    useDeleteRoom,
    useDeleteSection,
    useDeleteTier,
    usePalletByCell,
    useRacks,
    useRooms,
    useSections,
    useTiers,
    useUpdateCell,
    useUpdatePallet,
    useUpdateRack,
    useUpdateRoom,
    useUpdateSection,
    useUpdateTier,
} from "./topology";
export type {
    Cell,
    CellPayload,
    CellType,
    Pallet,
    PalletPayload,
    PalletStatus,
    PalletType,
    QrBatchItem,
    QrBatchItemType,
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
    cancelShipment,
    deleteShipment,
    fetchShipment,
    fetchShipments,
    updateShipment,
    useCancelShipment,
    useDeleteShipment,
    useShipment,
    useShipments,
    useUpdateShipment,
} from "./shipments";
export type {
    Shipment,
    ShipmentDirection,
    ShipmentFilters,
    ShipmentsListParams,
    ShipmentStatus,
    UpdateShipmentPayload,
} from "./shipments";

export {
    RECEIPT_ITEM_STATUS_LABELS,
    RECEIPT_STATUS_LABELS,
    cancelReceipt,
    checkReceipt,
    completeReceipt,
    deleteReceiptItem,
    fetchReceipt,
    fetchReceiptActBlob,
    fetchReceiptConflicts,
    fetchReceiptItems,
    fetchReceipts,
    resolveConflicts,
    updateReceiptItem,
    useCancelReceipt,
    useCheckReceipt,
    useCompleteReceipt,
    useDeleteReceiptItem,
    useReceipt,
    useReceiptConflicts,
    useReceiptItems,
    useReceipts,
    useResolveConflicts,
    useUpdateReceiptItem,
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
    UpdateReceiptItemPayload,
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