/**
 * Парсер текст-области `sample_groups` в массив SampleGroup.
 *
 * Формат строки: `prefix | middle | from-to`
 * Пример:
 *   TAA-A | 34076001 | 1-31
 *   TAA-B | 34076001 | 1-10
 *
 * Пустые строки и `#`-комментарии игнорируются.
 */
import type { SampleGroup } from "../api/ocr";

export interface ParseResult {
    groups: SampleGroup[];
    errors: string[];
}

export function parseSampleGroups(input: string): ParseResult {
    const groups: SampleGroup[] = [];
    const errors: string[] = [];

    const lines = input.split(/\r?\n/);
    lines.forEach((raw, index) => {
        const line = raw.trim();
        if (!line || line.startsWith("#")) return;

        const parts = line.split("|").map((p) => p.trim());
        if (parts.length !== 3) {
            errors.push(`Строка ${index + 1}: ожидается 3 части через «|», получено ${parts.length}`);
            return;
        }
        const [prefix, middle, rangeStr] = parts;
        if (!prefix) {
            errors.push(`Строка ${index + 1}: пустой prefix`);
            return;
        }
        if (!middle) {
            errors.push(`Строка ${index + 1}: пустой middle`);
            return;
        }

        const m = rangeStr.match(/^(\d+)\s*-\s*(\d+)$/);
        if (!m) {
            errors.push(`Строка ${index + 1}: диапазон «${rangeStr}» не в формате «from-to»`);
            return;
        }
        const from = parseInt(m[1], 10);
        const to = parseInt(m[2], 10);
        if (from < 1 || to < from) {
            errors.push(`Строка ${index + 1}: неверный диапазон ${from}-${to}`);
            return;
        }
        const digits = String(to).length;
        if (from > to) {
            errors.push(`Строка ${index + 1}: from > to`);
            return;
        }

        groups.push({
            prefix,
            middle,
            sequence_from: from,
            sequence_to: to,
            sequence_digits: digits,
            well_name: null,
            status: "NORMAL",
        });
    });

    return { groups, errors };
}