/**
 * Готовность задачи OCR к подтверждению (6e-2-web-fix4/fix5).
 * Динамические подсказки: что не заполнено / на что обратить внимание.
 * fix5: номер тары сверяется с распознанным на фото — иначе зелёный сигнал врёт.
 * Чистая логика, без UI — покрывается тестами.
 */
export interface ReadinessItem {
    key: string;
    label: string;
    ok: boolean;
    required: boolean;
    hint: string;
}

export interface Readiness {
    items: ReadinessItem[];
    /** Незаполненные обязательные — подтверждение заблокировано. */
    blockers: number;
    /** Необязательные замечания (участок, пробы с фото, аномалии). */
    warnings: number;
    /** Зелёный сигнал: обязательные заполнены и замечаний нет. */
    ready: boolean;
}

export interface ReadinessInput {
    siteName: string;
    researchTypeName: string;
    workOrderCoded: string;
    containerTypeName: string;
    containerNumber: string;
    /** Номер тары, распознанный на фото (null — не распознан). */
    photoContainerNumber: string | null;
    rangesCount: number;
    missingCount: number;
    anomalyCount: number;
}

/**
 * Нормализация номера тары: сначала верхний регистр, потом OCR-замены.
 * Порядок важен: иначе строчные o/i/l не приводятся к цифрам.
 * Убираются пробелы, дефисы, тире и точки; O/О→0, I/L/І→1.
 */
function normalizeContainerNumber(s: string): string {
    return (s ?? "")
        .toUpperCase()
        .replace(/[\s\-–—.]/g, "")
        .replace(/[OО]/g, "0")
        .replace(/[ILІ]/g, "1");
}

export function checkReadiness(i: ReadinessInput): Readiness {
    const photoCn = i.photoContainerNumber;
    const photoCnMatches =
        photoCn !== null &&
        normalizeContainerNumber(photoCn) === normalizeContainerNumber(i.containerNumber);
    const items: ReadinessItem[] = [
        {
            key: "site",
            label: "Участок",
            ok: i.siteName.trim() !== "",
            required: false,
            hint: "необязательно, но даёт подсказки по Н/З и пробам",
        },
        {
            key: "research_type",
            label: "Тип исследования",
            ok: i.researchTypeName.trim() !== "",
            required: true,
            hint: "выбери из списка",
        },
        {
            key: "work_order_coded",
            label: "Н/З (текущий)",
            ok: i.workOrderCoded.trim() !== "",
            required: true,
            hint: "введи вручную или выбери из подсказок",
        },
        {
            key: "container_type",
            label: "Тип тары",
            ok: i.containerTypeName.trim() !== "",
            required: true,
            hint: "выбери из списка",
        },
        {
            key: "container_number",
            label: "Номер тары",
            ok: i.containerNumber.trim() !== "",
            required: true,
            hint: "например 1 или T-001",
        },
        {
            key: "container_number_photo",
            label: "Номер тары сходится с фото",
            ok: photoCnMatches,
            required: false,
            hint:
                photoCn === null
                    ? "не распознан на фото — проверь вручную"
                    : `на фото ${photoCn}, введено ${i.containerNumber.trim()}`,
        },
        {
            key: "samples",
            label: "Пробы",
            ok: i.rangesCount > 0,
            required: true,
            hint: "добавь хотя бы одну группу проб",
        },
        {
            key: "photo_match",
            label: "Все пробы с фото внесены",
            ok: i.missingCount === 0,
            required: false,
            hint: `не внесено: ${i.missingCount}`,
        },
        {
            key: "anomalies",
            label: "Нет аномальных номеров",
            ok: i.anomalyCount === 0,
            required: false,
            hint: `выбивается из группы: ${i.anomalyCount}`,
        },
    ];

    const blockers = items.filter((x) => x.required && !x.ok).length;
    const warnings = items.filter((x) => !x.required && !x.ok).length;

    return {
        items,
        blockers,
        warnings,
        ready: blockers === 0 && i.missingCount === 0 && i.anomalyCount === 0 && photoCnMatches,
    };
}