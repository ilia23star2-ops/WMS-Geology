/** Вердикты резолвера OCR (6e-4-resolve): тип ответа сервера + хелпер подсказки. */

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