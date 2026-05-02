import { useState } from 'react'
import { apiFetch } from '../api/http'

/*
Tanggung jawab: UI cek DB ping (debugging).
 */
type PingResponse = { db: number }

export function DbPing() {
    const [log, setLog] = useState<string>('')

    async function ping() {
        setLog('calling /api/db/ping...')
        try {
            const data = await apiFetch<PingResponse>('/api/db/ping')
            setLog(`db ping ok: ${data.db}`)
        } catch {
            setLog('db ping failed')
        }
    }

    return (
        <div style={{ display: 'grid', gap: 8, maxWidth: 520, margin: '14px auto', textAlign: 'left' }}>
            <button onClick={ping}>DB Ping</button>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{log}</pre>
        </div>
    )
}