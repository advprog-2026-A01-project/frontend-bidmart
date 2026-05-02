export function normalizeError(e: unknown): string {
    const payloadError = getPayloadError(e)
    if (payloadError) return payloadError
    const status = getStatus(e)
    if (status) return `http_${status}`
    return 'unknown_error'
}

export function getStatus(e: unknown): number | null {
    if (typeof e !== 'object' || e === null) return null
    const obj = e as Record<string, unknown>
    const status = obj['status']
    return typeof status === 'number' ? status : null
}

function getPayloadError(e: unknown): string | null {
    if (typeof e !== 'object' || e === null) return null
    const obj = e as Record<string, unknown>
    const payload = obj['payload']
    if (typeof payload !== 'object' || payload === null) return null
    const p = payload as Record<string, unknown>
    const err = p['error']
    return typeof err === 'string' ? err : null
}