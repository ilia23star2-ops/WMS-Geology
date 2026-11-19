/**
 * Готовность задачи OCR к подтверждению (6e-2-web-fix4…fix7, 6e-2-web-2-fix3).
 * fix5: номер тары сверяется с распознанным на фото.
 * fix6: дубли проб — блокер; пробы списка, которых нет на фото — замечание.
 * fix7: readinessByKey (inline-подсказки) и readinessSummary (строка-статус).
 * 6e-2-web-2-fix3: правки, отличные от фото, требуют явного подтверждения.
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
    blockers: number;
    warnings: number;
    ready: boolean;
}

export interface ReadinessInput {
    siteName: string;
    researchTypeName: string;
    workOrderCoded: string;
    containerTypeName: string;
    containerNumber: string;
    photoContainerNumber: string | null;
    rangesCount: number;
    missingCount: number;
    anomalyCount: number;
    duplicateCount?: number;
    notOnPhotoCount?: number;
    /** Сколько правок отличаются от фото и ещё не подтверждены человеком. */
    unconfirmedEditCount?: number;
}

export type ReadinessTone = "success" | "warning" | "error";

export interface ReadinessSummary {
    tone: ReadinessTone;
    text: string;
    blockers: ReadinessItem[];
    warnings: ReadinessItem[];
}

/**
 * Нормализация номера тары: сначала верхний регистр, потом OCR-замены.
 * Порядок важен: иначе строчные o/i/l не приводятся к цифрам.
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
    const dupCount = i.duplicateCount ?? 0;
    const notOnPhoto = i.notOnPhotoCount ?? 0;
    const unconfirmed = i.unconfirmedEditCount ?? 0;
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
            key: "duplicates",
            label: "Нет дублей проб",
            ok: dupCount === 0,
            required: true,
            hint: `одинаковых номеров: ${dupCount} — удали лишнюю строку`,
        },
        {
            key: "edits_confirmed",
            label: "Правки, отличные от фото, подтверждены",
            ok: unconfirmed === 0,
            required: true,
            hint: `не подтверждено: ${unconfirmed} — сверь номер с фото и нажми «Подтвердить»`,
        },
        {
            key: "photo_match",
            label: "Все пробы с фото внесены",
            ok: i.missingCount === 0,
            required: false,
            hint: `не внесено: ${i.missingCount}`,
        },
        {
            key: "not_on_photo",
            label: "Все пробы списка есть на фото",
            ok: notOnPhoto === 0,
            required: false,
            hint: `нет на фото: ${notOnPhoto} — проверь, те ли это пробы`,
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
        ready:
            blockers === 0 &&
            i.missingCount === 0 &&
            i.anomalyCount === 0 &&
            notOnPhoto === 0 &&
            photoCnMatches,
    };
}

/** Доступ к пунктам по ключу — для inline-подсказок под полями. */
export function readinessByKey(r: Readiness): Record<string, ReadinessItem> {
    const out: Record<string, ReadinessItem> = {};
    for (const it of r.items) out[it.key] = it;
    return out;
}

/** Компактная сводка для строки-статуса внизу. */
export function readinessSummary(r: Readiness): ReadinessSummary {
    const blockers = r.items.filter((x) => x.required && !x.ok);
    const warnings = r.items.filter((x) => !x.required && !x.ok);
    if (blockers.length > 0) {
        return {
            tone: "error",
            text: `Не готово · обязательных: ${blockers.length}` +
                (warnings.length > 0 ? ` · замечаний: ${warnings.length}` : ""),
            blockers,
            warnings,
        };
    }
    if (warnings.length > 0) {
        return {
            tone: "warning",
            text: `Можно подтвердить · замечаний: ${warnings.length}`,
            blockers,
            warnings,
        };
    }
    return { tone: "success", text: "Готово к подтверждению", blockers, warnings };
}