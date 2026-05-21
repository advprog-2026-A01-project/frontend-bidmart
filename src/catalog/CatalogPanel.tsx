import { useEffect, useState } from 'react'
import { apiFetch } from '../api/http'
import { useAuth } from '../auth/useAuth'

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoryResponse = {
    id: string
    name: string
    description: string | null
    parentId: string | null
    children: CategoryResponse[]
}

type ListingResponse = {
    id: string
    title: string
    description: string | null
    sellerId: string
    sellerUsername: string
    category: { id: string; name: string } | null
    imageUrls: string[]
    startingPrice: number
    reservePrice: number | null
    currentPrice: number
    durationMinutes: number
    startTime: string | null
    endTime: string | null
    status: string
    bidCount: number
    createdAt: string
    updatedAt: string
}

type PageResponse<T> = {
    content: T[]
    totalElements: number
    totalPages: number
    number: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRp(value: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
}

function statusColor(status: string): string {
    switch (status) {
        case 'ACTIVE': return 'var(--color-text-success)'
        case 'EXTENDED': return 'var(--color-text-info)'
        case 'DRAFT': return 'var(--color-text-secondary)'
        case 'WON': return 'var(--color-text-success)'
        case 'UNSOLD': return 'var(--color-text-danger)'
        case 'CLOSED': return 'var(--color-text-secondary)'
        default: return 'var(--color-text-secondary)'
    }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusMsg({ msg, type }: { msg: string; type: 'ok' | 'err' | 'info' }) {
    if (!msg) return null
    const color = type === 'ok' ? 'var(--color-text-success)' : type === 'err' ? 'var(--color-text-danger)' : 'var(--color-text-secondary)'
    return <p style={{ margin: '8px 0 0', fontSize: 13, color }}>{msg}</p>
}

function ListingCard({ listing, onPublish, onCancel, isMine }: {
    listing: ListingResponse
    onPublish: (id: string) => void
    onCancel: (id: string) => void
    isMine: boolean
}) {
    return (
        <div style={{
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 12,
            padding: '12px 14px',
            background: 'var(--color-background-primary)',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {listing.title}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        {listing.category?.name ?? '—'} · {listing.sellerUsername}
                    </p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: statusColor(listing.status), whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {listing.status}
                </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10, fontSize: 13 }}>
                <div>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Current price</span>
                    <p style={{ margin: '2px 0 0', fontWeight: 500 }}>{formatRp(listing.currentPrice)}</p>
                </div>
                <div>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Bids</span>
                    <p style={{ margin: '2px 0 0', fontWeight: 500 }}>{listing.bidCount}</p>
                </div>
                <div>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Duration</span>
                    <p style={{ margin: '2px 0 0', fontWeight: 500 }}>{listing.durationMinutes} min</p>
                </div>
                <div>
                    <span style={{ color: 'var(--color-text-secondary)' }}>End time</span>
                    <p style={{ margin: '2px 0 0', fontWeight: 500 }}>
                        {listing.endTime ? new Date(listing.endTime).toLocaleString('id-ID') : '—'}
                    </p>
                </div>
            </div>

            <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--color-text-secondary)' }}>
                ID: {listing.id}
            </p>

            {isMine && listing.status === 'DRAFT' && listing.bidCount === 0 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => onPublish(listing.id)} style={{ flex: 1, fontSize: 13, padding: '6px 0' }}>
                        Publish
                    </button>
                    <button onClick={() => onCancel(listing.id)} style={{ flex: 1, fontSize: 13, padding: '6px 0', color: 'var(--color-text-danger)', borderColor: 'var(--color-border-danger)' }}>
                        Cancel
                    </button>
                </div>
            )}
        </div>
    )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

type CatalogTab = 'browse' | 'my' | 'create' | 'categories'

export function CatalogPanel() {
    const { user, tokens } = useAuth()
    const accessToken = tokens?.accessToken ?? null

    const [tab, setTab] = useState<CatalogTab>('browse')

    // ── Browse state ──────────────────────────────────────────────────────────
    const [listings, setListings] = useState<ListingResponse[]>([])
    const [browseLoading, setBrowseLoading] = useState(false)
    const [browseMsg, setBrowseMsg] = useState('')
    const [keyword, setKeyword] = useState('')
    const [page, setPage] = useState(0)
    const [totalPages, setTotalPages] = useState(0)

    // ── My listings state ─────────────────────────────────────────────────────
    const [myListings, setMyListings] = useState<ListingResponse[]>([])
    const [myMsg, setMyMsg] = useState('')
    const [myLoading, setMyLoading] = useState(false)

    // ── Create listing state ──────────────────────────────────────────────────
    const [categories, setCategories] = useState<CategoryResponse[]>([])
    const [createForm, setCreateForm] = useState({
        title: '',
        description: '',
        categoryId: '',
        startingPrice: '',
        reservePrice: '',
        durationMinutes: '60',
        imageUrls: '',
    })
    const [createMsg, setCreateMsg] = useState('')
    const [createLoading, setCreateLoading] = useState(false)

    // ── Categories tab state ──────────────────────────────────────────────────
    const [catMsg, setCatMsg] = useState('')
    const [newCatName, setNewCatName] = useState('')
    const [newCatDesc, setNewCatDesc] = useState('')
    const [newCatParentId, setNewCatParentId] = useState('')
    const [catLoading, setCatLoading] = useState(false)

    // ── Flatten category tree untuk dropdown ──────────────────────────────────
    function flattenCategories(cats: CategoryResponse[], depth = 0): { id: string; label: string }[] {
        return cats.flatMap(c => [
            { id: c.id, label: `${'  '.repeat(depth)}${c.name}` },
            ...flattenCategories(c.children ?? [], depth + 1),
        ])
    }
    const flatCats = flattenCategories(categories)

    // ── Load categories ───────────────────────────────────────────────────────
    async function loadCategories() {
        try {
            const res = await apiFetch<CategoryResponse[]>('/api/categories', { accessToken: accessToken ?? undefined })
            setCategories(res)
        } catch {
            // silent — dipakai di beberapa tab
        }
    }

    // ── Browse listings ───────────────────────────────────────────────────────
    async function browseListings(pageNum = 0) {
        setBrowseLoading(true)
        setBrowseMsg('')
        try {
            const params = new URLSearchParams()
            if (keyword.trim()) params.set('keyword', keyword.trim())
            params.set('page', String(pageNum))
            params.set('size', '10')
            const res = await apiFetch<PageResponse<ListingResponse>>(
                `/api/listings?${params.toString()}`,
                { accessToken: accessToken ?? undefined }
            )
            setListings(res.content)
            setTotalPages(res.totalPages)
            setPage(res.number)
            setBrowseMsg(`${res.totalElements} listing ditemukan`)
        } catch {
            setBrowseMsg('Gagal memuat listings.')
        } finally {
            setBrowseLoading(false)
        }
    }

    // ── My listings ───────────────────────────────────────────────────────────
    async function loadMyListings() {
        if (!accessToken) { setMyMsg('Harus login dulu.'); return }
        setMyLoading(true)
        setMyMsg('')
        try {
            const res = await apiFetch<ListingResponse[]>('/api/listings/my', { accessToken })
            setMyListings(res)
            setMyMsg(`${res.length} listing milikmu`)
        } catch {
            setMyMsg('Gagal memuat listings.')
        } finally {
            setMyLoading(false)
        }
    }

    async function publishListing(id: string) {
        if (!accessToken) return
        try {
            await apiFetch(`/api/listings/${id}/publish`, { method: 'POST', accessToken })
            setMyMsg('Berhasil publish!')
            void loadMyListings()
        } catch {
            setMyMsg('Gagal publish listing.')
        }
    }

    async function cancelListing(id: string) {
        if (!accessToken) return
        if (!window.confirm('Yakin cancel listing ini?')) return
        try {
            await apiFetch(`/api/listings/${id}`, { method: 'DELETE', accessToken })
            setMyMsg('Listing di-cancel.')
            void loadMyListings()
        } catch {
            setMyMsg('Gagal cancel listing.')
        }
    }

    // ── Create listing ────────────────────────────────────────────────────────
    async function createListing() {
        if (!accessToken) { setCreateMsg('Harus login dulu.'); return }
        const { title, categoryId, startingPrice, durationMinutes } = createForm
        if (!title.trim() || !categoryId || !startingPrice || !durationMinutes) {
            setCreateMsg('Title, kategori, starting price, dan durasi wajib diisi.')
            return
        }
        setCreateLoading(true)
        setCreateMsg('')
        try {
            const body: Record<string, unknown> = {
                title: title.trim(),
                description: createForm.description.trim() || null,
                categoryId,
                startingPrice: parseFloat(startingPrice),
                durationMinutes: parseInt(durationMinutes),
            }
            if (createForm.reservePrice.trim()) {
                body.reservePrice = parseFloat(createForm.reservePrice)
            }
            if (createForm.imageUrls.trim()) {
                body.imageUrls = createForm.imageUrls.split('\n').map(u => u.trim()).filter(Boolean)
            }
            await apiFetch('/api/listings', {
                method: 'POST',
                accessToken,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            setCreateMsg('Listing berhasil dibuat! Status: DRAFT')
            setCreateForm({ title: '', description: '', categoryId: '', startingPrice: '', reservePrice: '', durationMinutes: '60', imageUrls: '' })
        } catch {
            setCreateMsg('Gagal membuat listing.')
        } finally {
            setCreateLoading(false)
        }
    }

    // ── Create category ───────────────────────────────────────────────────────
    async function createCategory() {
        if (!accessToken) { setCatMsg('Harus login sebagai ADMIN.'); return }
        if (!newCatName.trim()) { setCatMsg('Nama kategori wajib diisi.'); return }
        setCatLoading(true)
        setCatMsg('')
        try {
            const params = new URLSearchParams()
            params.set('name', newCatName.trim())
            if (newCatDesc.trim()) params.set('description', newCatDesc.trim())
            if (newCatParentId) params.set('parentId', newCatParentId)
            await apiFetch(`/api/categories?${params.toString()}`, {
                method: 'POST',
                accessToken,
            })
            setCatMsg('Kategori berhasil dibuat!')
            setNewCatName('')
            setNewCatDesc('')
            setNewCatParentId('')
            void loadCategories()
        } catch {
            setCatMsg('Gagal membuat kategori. Pastikan role ADMIN.')
        } finally {
            setCatLoading(false)
        }
    }

    async function deleteCategory(id: string, name: string) {
        if (!accessToken) return
        if (!window.confirm(`Hapus kategori "${name}"?`)) return
        try {
            await apiFetch(`/api/categories/${id}`, { method: 'DELETE', accessToken })
            setCatMsg('Kategori dihapus.')
            void loadCategories()
        } catch {
            setCatMsg('Gagal menghapus kategori.')
        }
    }

    // ── Effects ───────────────────────────────────────────────────────────────
    useEffect(() => {
        void loadCategories()
        void browseListings(0)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (tab === 'my') void loadMyListings()
        if (tab === 'categories') void loadCategories()
        if (tab === 'create') void loadCategories()
    }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Tab button style ──────────────────────────────────────────────────────
    function tabStyle(t: CatalogTab) {
        const active = tab === t
        return {
            padding: '7px 14px',
            borderRadius: 999,
            border: active ? '0.5px solid var(--color-border-info)' : '0.5px solid var(--color-border-tertiary)',
            background: active ? 'var(--color-background-info)' : 'var(--color-background-primary)',
            color: active ? 'var(--color-text-info)' : 'var(--color-text-primary)',
            fontSize: 13,
            fontWeight: active ? 500 : 400,
            cursor: 'pointer',
        } as React.CSSProperties
    }

    return (
        <div style={{ display: 'grid', gap: 16, padding: '4px 0' }}>

            {/* Tab row */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button style={tabStyle('browse')} onClick={() => setTab('browse')}>Browse</button>
                {user && <button style={tabStyle('my')} onClick={() => setTab('my')}>My listings</button>}
                {user && <button style={tabStyle('create')} onClick={() => setTab('create')}>+ Buat listing</button>}
                <button style={tabStyle('categories')} onClick={() => setTab('categories')}>Kategori</button>
            </div>

            {/* ── Browse tab ─────────────────────────────────────────────────── */}
            {tab === 'browse' && (
                <div style={{ display: 'grid', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            value={keyword}
                            onChange={e => setKeyword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && browseListings(0)}
                            placeholder="Cari listing..."
                            style={{ flex: 1 }}
                        />
                        <button onClick={() => browseListings(0)} disabled={browseLoading} style={{ flexShrink: 0 }}>
                            {browseLoading ? 'Loading...' : 'Cari'}
                        </button>
                    </div>

                    <StatusMsg msg={browseMsg} type="info" />

                    <div style={{ display: 'grid', gap: 10 }}>
                        {listings.length === 0 && !browseLoading && (
                            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>Tidak ada listing.</p>
                        )}
                        {listings.map(l => (
                            <ListingCard
                                key={l.id}
                                listing={l}
                                isMine={l.sellerId === user?.username}
                                onPublish={publishListing}
                                onCancel={cancelListing}
                            />
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                            <button onClick={() => browseListings(page - 1)} disabled={page === 0} style={{ padding: '5px 12px' }}>←</button>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Halaman {page + 1} / {totalPages}</span>
                            <button onClick={() => browseListings(page + 1)} disabled={page >= totalPages - 1} style={{ padding: '5px 12px' }}>→</button>
                        </div>
                    )}
                </div>
            )}

            {/* ── My listings tab ────────────────────────────────────────────── */}
            {tab === 'my' && (
                <div style={{ display: 'grid', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button onClick={loadMyListings} disabled={myLoading} style={{ fontSize: 13, padding: '6px 14px' }}>
                            {myLoading ? 'Loading...' : 'Reload'}
                        </button>
                        <StatusMsg msg={myMsg} type="info" />
                    </div>

                    {myListings.length === 0 && !myLoading && (
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>Belum ada listing.</p>
                    )}
                    {myListings.map(l => (
                        <ListingCard
                            key={l.id}
                            listing={l}
                            isMine={true}
                            onPublish={publishListing}
                            onCancel={cancelListing}
                        />
                    ))}
                </div>
            )}

            {/* ── Create listing tab ─────────────────────────────────────────── */}
            {tab === 'create' && (
                <div style={{ display: 'grid', gap: 12 }}>
                    {!user && (
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-danger)' }}>Harus login sebagai SELLER untuk membuat listing.</p>
                    )}

                    <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Title *</span>
                        <input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder="Judul listing" />
                    </label>

                    <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Deskripsi</span>
                        <textarea
                            value={createForm.description}
                            onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Deskripsi barang (opsional)"
                            rows={3}
                            style={{ resize: 'vertical' }}
                        />
                    </label>

                    <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Kategori *</span>
                        <select value={createForm.categoryId} onChange={e => setCreateForm(f => ({ ...f, categoryId: e.target.value }))}>
                            <option value="">-- Pilih kategori --</option>
                            {flatCats.map(c => (
                                <option key={c.id} value={c.id}>{c.label}</option>
                            ))}
                        </select>
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Starting price (Rp) *</span>
                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={createForm.startingPrice}
                                onChange={e => setCreateForm(f => ({ ...f, startingPrice: e.target.value }))}
                                placeholder="100000"
                            />
                        </label>
                        <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Reserve price (Rp)</span>
                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={createForm.reservePrice}
                                onChange={e => setCreateForm(f => ({ ...f, reservePrice: e.target.value }))}
                                placeholder="Opsional"
                            />
                        </label>
                    </div>

                    <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Durasi (menit) *</span>
                        <input
                            type="number"
                            min="1"
                            value={createForm.durationMinutes}
                            onChange={e => setCreateForm(f => ({ ...f, durationMinutes: e.target.value }))}
                            placeholder="60"
                        />
                    </label>

                    <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Image URLs (satu per baris, opsional)</span>
                        <textarea
                            value={createForm.imageUrls}
                            onChange={e => setCreateForm(f => ({ ...f, imageUrls: e.target.value }))}
                            placeholder="https://example.com/img.jpg"
                            rows={2}
                            style={{ resize: 'vertical' }}
                        />
                    </label>

                    <button
                        onClick={createListing}
                        disabled={createLoading || !user}
                        style={{ padding: '9px 0', fontSize: 14, fontWeight: 500 }}
                    >
                        {createLoading ? 'Membuat...' : 'Buat Listing'}
                    </button>

                    <StatusMsg msg={createMsg} type={createMsg.includes('berhasil') ? 'ok' : 'err'} />
                </div>
            )}

            {/* ── Categories tab ─────────────────────────────────────────────── */}
            {tab === 'categories' && (
                <div style={{ display: 'grid', gap: 16 }}>
                    {/* List kategori */}
                    <div>
                        <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 500 }}>Daftar kategori</p>
                        {categories.length === 0 && (
                            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>Belum ada kategori.</p>
                        )}
                        <div style={{ display: 'grid', gap: 6 }}>
                            {flatCats.map(c => (
                                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, fontSize: 13 }}>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{c.label}</span>
                                    {user?.role === 'ADMIN' && (
                                        <button
                                            onClick={() => deleteCategory(c.id, c.label)}
                                            style={{ padding: '3px 10px', fontSize: 12, color: 'var(--color-text-danger)', borderColor: 'var(--color-border-danger)' }}
                                        >
                                            Hapus
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Buat kategori — hanya admin */}
                    {user?.role === 'ADMIN' && (
                        <div style={{ border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, padding: '12px 14px', display: 'grid', gap: 10 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>Buat kategori baru (Admin)</p>

                            <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
                                <span style={{ color: 'var(--color-text-secondary)' }}>Nama *</span>
                                <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nama kategori" />
                            </label>

                            <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
                                <span style={{ color: 'var(--color-text-secondary)' }}>Deskripsi</span>
                                <input value={newCatDesc} onChange={e => setNewCatDesc(e.target.value)} placeholder="Opsional" />
                            </label>

                            <label style={{ display: 'grid', gap: 5, fontSize: 13 }}>
                                <span style={{ color: 'var(--color-text-secondary)' }}>Parent kategori</span>
                                <select value={newCatParentId} onChange={e => setNewCatParentId(e.target.value)}>
                                    <option value="">-- Root (tanpa parent) --</option>
                                    {flatCats.map(c => (
                                        <option key={c.id} value={c.id}>{c.label}</option>
                                    ))}
                                </select>
                            </label>

                            <button onClick={createCategory} disabled={catLoading} style={{ fontSize: 13, padding: '7px 0' }}>
                                {catLoading ? 'Membuat...' : 'Buat Kategori'}
                            </button>

                            <StatusMsg msg={catMsg} type={catMsg.includes('berhasil') ? 'ok' : 'err'} />
                        </div>
                    )}

                    {user?.role !== 'ADMIN' && (
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                            Hanya ADMIN yang bisa membuat/menghapus kategori.
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}
