export type ApiError = { error: string }

export type ApiFetchOptions = Omit<RequestInit, 'headers'> & {
    headers?: Record<string, string>
    accessToken?: string
}

const apiBaseUrl = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/+$/, '')

function buildApiUrl(path: string): string {
    if (/^https?:\/\//.test(path)) {
        return path
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`

    if (!apiBaseUrl) {
        return normalizedPath
    }

    return `${apiBaseUrl}${normalizedPath}`
}

export async function apiFetch<T>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
    const { headers: optionHeaders, accessToken, ...requestInit } = opts

    const headers: Record<string, string> = {
        ...(optionHeaders ?? {}),
    }

    if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`
    }

    const res = await fetch(buildApiUrl(path), {
        ...requestInit,
        headers,
    })

    const contentType = res.headers.get('content-type') ?? ''
    const isJson = contentType.includes('application/json')

    if (!res.ok) {
        const payload = isJson ? ((await res.json()) as unknown) : await res.text()
        throw Object.assign(new Error('API_ERROR'), { status: res.status, payload })
    }

    if (isJson) {
        return (await res.json()) as T
    }

    return (await res.text()) as unknown as T
}
