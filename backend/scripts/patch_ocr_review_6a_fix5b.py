"""Патч OcrReviewPage.tsx для 6a-fix5b:
  1. +parseErrors state.
  2. prefill site / container_type из extracted.
  3. fallback проб: если parseSampleInput падает — сохранить raw.
  4. +<Alert> с ошибками парсинга.
  5. ImageWithBboxes: words[] клики + fieldForWord (слово → поле).

Идемпотентно. Одноразовая утилита c-3.x-migration-6a-fix5b.
"""
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from pathlib import Path

WEB = Path(__file__).resolve().parents[2] / "web"
FILE = WEB / "src" / "pages" / "OcrReviewPage.tsx"


def patch(text: str) -> str:
    # ---- 1. parseErrors state ----
    if "parseErrors" not in text:
        anchor = '    const [submitOk, setSubmitOk] = useState<string | null>(null);'
        new = (
            anchor + "\n"
            '    const [parseErrors, setParseErrors] = useState<string[]>([]);'
        )
        if anchor in text:
            text = text.replace(anchor, new, 1)
            print("+ parseErrors state")
        else:
            print("? anchor submitOk not found")
    else:
        print("= parseErrors state")

    # ---- 2. prefill site / container_type ----
    if "setSiteName(ex.site)" not in text:
        anchor = "        if (ex.container_number) setContainerNumber(ex.container_number);"
        new = (
            anchor + "\n"
            "        if (ex.site) setSiteName(ex.site);\n"
            "        if (ex.container_type) setContainerTypeName(ex.container_type);"
        )
        if anchor in text:
            text = text.replace(anchor, new, 1)
            print("+ prefill site/container_type")
        else:
            print("? anchor container_number not found")
    else:
        print("= prefill site/container_type")

    # ---- 3. fallback проб ----
    if "parseErrors.push" not in text:
        anchor = (
            "            const parsed: RangeEntry[] = [];\n"
            "            for (const num of ex.samples) {\n"
            "                const r = parseSampleInput(num, opts);\n"
            "                if (r.ok) {\n"
            "                    parsed.push({\n"
            "                        id: newRangeId(),\n"
            "                        rawInput: num,\n"
            "                        ...r.value,\n"
            "                        allSeqs: makeAllSeqs(r.value.sequenceFrom, r.value.sequenceTo),\n"
            "                        skippedSeqs: [],\n"
            "                        selectedSeqs: [],\n"
            "                    });\n"
            "                }\n"
            "            }\n"
            "            setRanges(parsed);"
        )
        new = (
            "            const parsed: RangeEntry[] = [];\n"
            "            const errors: string[] = [];\n"
            "            for (const num of ex.samples) {\n"
            "                const r = parseSampleInput(num, opts);\n"
            "                if (r.ok) {\n"
            "                    parsed.push({\n"
            "                        id: newRangeId(),\n"
            "                        rawInput: num,\n"
            "                        ...r.value,\n"
            "                        allSeqs: makeAllSeqs(r.value.sequenceFrom, r.value.sequenceTo),\n"
            "                        skippedSeqs: [],\n"
            "                        selectedSeqs: [],\n"
            "                    });\n"
            "                } else {\n"
            "                    errors.push(num);\n"
            "                    parsed.push({\n"
            "                        id: newRangeId(),\n"
            "                        rawInput: num,\n"
            "                        prefix: \"\",\n"
            "                        middle: num,\n"
            "                        sequenceFrom: 1,\n"
            "                        sequenceTo: 1,\n"
            "                        sequenceDigits: 1,\n"
            "                        wellName: null,\n"
            "                        allSeqs: [1],\n"
            "                        skippedSeqs: [],\n"
            "                        selectedSeqs: [],\n"
            "                    });\n"
            "                }\n"
            "            }\n"
            "            setRanges(parsed);\n"
            "            setParseErrors(errors);"
        )
        if anchor in text:
            text = text.replace(anchor, new, 1)
            print("+ fallback проб")
        else:
            print("? anchor prefill samples not found")
    else:
        print("= fallback проб")

    # ---- 4. <Alert> с ошибками парсинга ----
    if "parseErrors.length > 0" not in text:
        anchor = '                        {submitError && <Alert severity="error">{submitError}</Alert>}'
        new = (
            "                        {parseErrors.length > 0 && (\n"
            "                            <Alert severity=\"warning\">\n"
            "                                Не удалось разобрать: {parseErrors.join(\", \")}.\n"
            "                                Введены как есть — проверь номер и скважину.\n"
            "                            </Alert>\n"
            "                        )}\n"
            + anchor
        )
        if anchor in text:
            text = text.replace(anchor, new, 1)
            print("+ Alert parseErrors")
        else:
            print("? anchor submitError Alert not found")
    else:
        print("= Alert parseErrors")

    # ---- 5. ImageWithBboxes: words[] клики + fieldForWord ----
    if "fieldForWord" not in text:
        # 5a. Вставить helper перед return ImageWithBboxes
        anchor_helper = (
            "    const zones: OcrZone[] = task.zones ?? [];"
        )
        helper = (
            "    const zones: OcrZone[] = task.zones ?? [];\n"
            "    const ex = task.raw_ocr_data?.extracted;\n"
            "\n"
            "    // 6a-fix5b: слово → к какому полю относится (для клика).\n"
            "    function fieldForWord(text: string): string | null {\n"
            "        const t = text.trim().toUpperCase();\n"
            "        if (!t || !ex) return null;\n"
            "        if (ex.work_order_coded && ex.work_order_coded.toUpperCase().includes(t)) return 'work_order_coded';\n"
            "        if (ex.work_order_incoming && ex.work_order_incoming.toUpperCase().includes(t)) return 'work_order_incoming';\n"
            "        if (ex.container_number && ex.container_number.toUpperCase().includes(t)) return 'container_number';\n"
            "        if (ex.site && ex.site.toUpperCase().includes(t)) return 'site';\n"
            "        if (ex.research_type && ex.research_type.toUpperCase() === t) return 'research_type';\n"
            "        if (ex.container_type && ex.container_type.toUpperCase() === t) return 'container_type';\n"
            "        if (ex.samples && ex.samples.some((s) => s.toUpperCase().includes(t))) return 'sample';\n"
            "        return null;\n"
            "    }"
        )
        if anchor_helper in text:
            text = text.replace(anchor_helper, helper, 1)
            print("+ fieldForWord helper")
        else:
            print("? anchor zones not found (helper)")

        # 5b. Заменить блок words[] рендера
        anchor_words = (
            "                            {zones.length === 0 && task.raw_ocr_data?.words.map((w, i) => (\n"
            "                                <polygon\n"
            "                                    key={`word-${i}`}\n"
            "                                    points={w.bbox\n"
            "                                        .map(([x, y]) => `${x},${y}`)\n"
            "                                        .join(\" \")}\n"
            "                                    fill=\"rgba(30, 58, 95, 0.15)\"\n"
            "                                    stroke=\"rgba(30, 58, 95, 0.9)\"\n"
            "                                    strokeWidth={2}\n"
            "                                />\n"
            "                            ))}"
        )
        new_words = (
            "                            {task.raw_ocr_data?.words.map((w, i) => {\n"
            "                                const targetField = fieldForWord(w.text);\n"
            "                                const isActive =\n"
            "                                    targetField !== null && activeField === targetField;\n"
            "                                return (\n"
            "                                    <polygon\n"
            "                                        key={`word-${i}`}\n"
            "                                        points={w.bbox\n"
            "                                            .map(([x, y]) => `${x},${y}`)\n"
            "                                            .join(\" \")}\n"
            "                                        fill={\n"
            "                                            isActive\n"
            "                                                ? \"rgba(76, 175, 80, 0.3)\"\n"
            "                                                : \"rgba(30, 58, 95, 0.15)\"\n"
            "                                        }\n"
            "                                        stroke={\n"
            "                                            isActive\n"
            "                                                ? \"rgba(76, 175, 80, 0.95)\"\n"
            "                                                : \"rgba(30, 58, 95, 0.5)\"\n"
            "                                        }\n"
            "                                        strokeWidth={isActive ? 2.5 : 1}\n"
            "                                        style={{ pointerEvents: \"all\", cursor: \"pointer\" }}\n"
            "                                        onClick={() => {\n"
            "                                            if (targetField) onBboxClick(targetField);\n"
            "                                        }}\n"
            "                                    >\n"
            "                                        <title>{w.text}</title>\n"
            "                                    </polygon>\n"
            "                                );\n"
            "                            })}"
        )
        if anchor_words in text:
            text = text.replace(anchor_words, new_words, 1)
            print("+ words[] clicks")
        else:
            print("? anchor words render not found")
    else:
        print("= fieldForWord / words[] clicks")

    return text


def main():
    original = FILE.read_text(encoding="utf-8")
    patched = patch(original)
    if patched == original:
        print("Ничего не изменилось.")
        return
    FILE.write_text(patched, encoding="utf-8")
    print("OK")


if __name__ == "__main__":
    main()