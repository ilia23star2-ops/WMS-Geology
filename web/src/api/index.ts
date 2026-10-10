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

export type {
    ApiError,
    LoginPayload,
    LoginResponse,
    PaginatedResponse,
    RefreshResponse,
    User,
} from "./types";