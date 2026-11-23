/** Вердикты резолвера OCR (6e-4-resolve): тип ответа сервера + хелперы. */

export interface ZoneVerdict {
    zone_type: string;
    raw: string;
    canonical: string;
    value: string | null;
    resolved: boolean;
    needs_input: boolean;
    reason: string;
}

/** Текст подсказки «уточните» для поля, либо null, если вердикт нормальный. */
export function verdictHint(verdicts: ZoneVerdict[], key: string): string | null {
    const v = verdicts.find((x) => x.zone_type === key);
    if (!v || !v.needs_input) return null;
    return v.reason || "не найдено в справочнике";
}

/** Безопасно достаёт список вердиктов из raw_ocr_data (поле может отсутствовать). */
export function parseVerdicts(raw: unknown): ZoneVerdict[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter(
        (v): v is ZoneVerdict =>
            !!v &&
            typeof v === "object" &&
            typeof (v as ZoneVerdict).zone_type === "string",
    );
}