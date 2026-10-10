/**
 * Публичный API-слой приложения.
 */

export { apiClient } from "./client";
export { tokenStorage } from "./tokenStorage";
export { login, logout, fetchMe } from "./auth";

export {
    CONTAINER_STATUS_LABELS,
    downloadLabelPdf,
    fetchContainers,
    useContainers,
} from "./containers";
export type {
    Container,
    ContainerFilters,
    ContainerStatus,
    ContainersListParams,
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

export type {
    ApiError,
    LoginPayload,
    LoginResponse,
    PaginatedResponse,
    RefreshResponse,
    User,
} from "./types";