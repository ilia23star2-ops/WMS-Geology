/**
 * Отображаемое имя пакета OCR (6e-3-backend).
 * Сервер хранит `name` (может быть пустой); fallback «Пакет #id».
 * Чистая функция — покрыта тестами.
 */

export function displayBatchName(name: string | null | undefined, id: number): string {
    const clean = (name ?? "").trim();
    return clean || `Пакет #${id}`;
}