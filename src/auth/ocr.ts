export type OcrProgress = {
    status: string
    progress: number
}

function cleanLine(raw: string): string {
    return (raw ?? '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[|]/g, 'I')
        .replace(/\s+/g, ' ')
        .trim()
}

function normalizeStrict(raw: string): string {
    return cleanLine(raw)
        .replace(/[^A-Za-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function isLikelyNoise(line: string): boolean {
    if (!line) return true
    const upper = line.toUpperCase()

    const blocked = [
        'PROVINSI', 'KABUPATEN', 'KOTA', 'KECAMATAN', 'KELURAHAN',
        'NIK', 'TEMPAT', 'TGL', 'LAHIR', 'JENIS', 'KELAMIN',
        'ALAMAT', 'RT', 'RW', 'DESA', 'AGAMA', 'STATUS',
        'PEKERJAAN', 'KEWARGANEGARAAN', 'BERLAKU',
        'UNIVERSITAS', 'FAKULTAS', 'PROGRAM STUDI', 'NPM', 'NIM',
        'STUDENT', 'CARD', 'KARTU', 'TANDA', 'MAHASISWA',
        'VALID', 'EXPIRE', 'EXP', 'BLOOD', 'GOL'
    ]

    if (blocked.some((token) => upper.includes(token))) {
        return true
    }

    if (/\d{4,}/.test(line)) {
        return true
    }

    const lettersOnly = line.replace(/[^A-Za-z]/g, '')
    if (lettersOnly.length < 4) {
        return true
    }

    return false
}

function looksLikePersonName(line: string): boolean {
    if (!line) return false
    if (isLikelyNoise(line)) return false

    const normalized = normalizeStrict(line)
    if (!normalized) return false

    const tokens = normalized.split(' ').filter(Boolean)
    if (tokens.length < 2 || tokens.length > 5) {
        return false
    }

    return tokens.every((token) => /^[A-Za-z]{2,}$/.test(token))
}

function extractAfterLabel(lines: string[], labels: string[]): string | null {
    for (let i = 0; i < lines.length; i++) {
        const original = lines[i]
        const upper = original.toUpperCase()

        for (const label of labels) {
            if (!upper.includes(label)) continue

            const idx = upper.indexOf(label)
            const after = cleanLine(original.slice(idx + label.length))
                .replace(/^[:\- ]+/, '')
                .trim()

            if (looksLikePersonName(after)) {
                return after
            }

            const next = cleanLine(lines[i + 1] ?? '')
            if (looksLikePersonName(next)) {
                return next
            }
        }
    }
    return null
}

function fallbackExtractName(lines: string[]): string | null {
    const candidates = lines
        .map(cleanLine)
        .filter(looksLikePersonName)
        .sort((a, b) => b.length - a.length)

    return candidates[0] ?? null
}

export function extractLikelyIdentityName(ocrText: string, documentType: 'KTP' | 'KTM'): string {
    const lines = (ocrText ?? '')
        .split(/\r?\n/)
        .map(cleanLine)
        .filter(Boolean)

    const primaryLabels = documentType === 'KTP'
        ? ['NAMA']
        : ['NAMA', 'NAME']

    const fromLabel = extractAfterLabel(lines, primaryLabels)
    if (fromLabel) {
        return fromLabel
    }

    const fallback = fallbackExtractName(lines)
    return fallback ?? ''
}

export function exactIdentityNameMatches(legalName: string, ocrText: string): boolean {
    const strictName = normalizeStrict(legalName)
    if (!strictName) return false

    const lines = (ocrText ?? '')
        .split(/\r?\n/)
        .map(normalizeStrict)
        .filter(Boolean)

    return lines.some((line) => line === strictName || line.includes(strictName))
}

export async function extractIdentityText(
    file: File,
    onProgress?: (progress: OcrProgress) => void,
): Promise<string> {
    const createWorker = window.Tesseract?.createWorker
    if (!createWorker) {
        throw new Error('ocr_unavailable')
    }

    const worker = await createWorker('eng', 1, {
        logger: (message) => {
            onProgress?.({
                status: message.status ?? 'processing',
                progress: typeof message.progress === 'number' ? message.progress : 0,
            })
        },
    })

    try {
        const result = await worker.recognize(file)
        return result.data.text ?? ''
    } finally {
        await worker.terminate()
    }
}

export function formatOcrProgress(progress: OcrProgress | null): string {
    if (!progress) {
        return 'Belum memproses OCR.'
    }
    const pct = Math.max(0, Math.min(100, Math.round(progress.progress * 100)))
    return `${progress.status} (${pct}%)`
}