'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

type Entry = {
    entry_id: string;
    display_name: string;
    email?: string;
    created_at: string;
    is_paid?: boolean;
};

type Pick = {
    team_id: string;
    team_name: string;
    tier: string;
    rank: number | null;
};

type EntryResponse = {
    entry: Entry;
    picks: Pick[];
};

const TIER_ORDER = [
    'TOP_1_5',
    'TOP_6_10',
    'TOP_11_15',
    'TOP_16_25',
    'UNRANKED',
] as const;

const TIER_LABEL: Record<string, string> = {
    TOP_1_5: 'Top 1–5',
    TOP_6_10: 'Ranks 6–10',
    TOP_11_15: 'Ranks 11–15',
    TOP_16_25: 'Ranks 16–25',
    UNRANKED: 'Unranked',
};

// Theme-safe UI tokens (works with your globals.css vars)
const ui = {
    page: {
        padding: 16,
        maxWidth: 900,
        margin: '0 auto',
        color: 'var(--foreground)',
    } as const,
    card: {
        marginTop: 10,
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 12,
        background: 'var(--background)',
    } as const,
    section: {
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 12,
        background: 'var(--background)',
    } as const,
    muted: {
        color: 'var(--muted)',
    } as const,
    errorBox: {
        background: 'rgba(255, 0, 0, 0.08)',
        border: '1px solid rgba(255, 0, 0, 0.25)',
        padding: 10,
        borderRadius: 10,
        whiteSpace: 'pre-line' as const,
        fontFamily: 'monospace',
        fontSize: 14,
        color: 'var(--foreground)',
    } as const,
    btnPrimary: {
        border: '1px solid var(--foreground)',
        background: 'var(--foreground)',
        color: 'var(--background)',
        borderRadius: 10,
        padding: '8px 10px',
        cursor: 'pointer',
    } as const,
    btnSecondary: {
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--foreground)',
        borderRadius: 10,
        padding: '8px 10px',
        cursor: 'pointer',
    } as const,
    pickRow: {
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: 10,
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        alignItems: 'baseline',
        background: 'var(--background)',
    } as const,
    btnPillLink: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--foreground)',
        borderRadius: 999,
        padding: '8px 14px',
        fontWeight: 600,
        cursor: 'pointer',
        textDecoration: 'none',
    } as const,
    btnPill: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--foreground)',
        borderRadius: 999,
        padding: '8px 14px',
        fontWeight: 600,
        cursor: 'pointer',
        textDecoration: 'none',
        fontSize: 14,
    } as const,
};

export default function EntryPage() {
    const params = useParams();
    const entryId = params?.entryId
        ? decodeURIComponent(String(params.entryId))
        : '';

    const [data, setData] = useState<EntryResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!entryId) return;

        let cancelled = false;

        async function run() {
            setLoading(true);
            setErr(null);

            try {
                const res = await fetch(
                    `/api/entry/${encodeURIComponent(entryId)}`,
                    {
                        cache: 'no-store',
                    },
                );
                const json = await res.json();

                if (!res.ok) {
                    let errorMessage = json?.error ?? 'Failed to load entry.';

                    if (json?.error === 'Not found') {
                        errorMessage = `Entry "${entryId}" not found.`;
                        if (json.sample_entry_ids?.length > 0) {
                            errorMessage += `\n\nAvailable entry IDs: ${json.sample_entry_ids.join(', ')}`;
                        }
                        if (json.requested) {
                            errorMessage += `\n\nRequested ID: "${json.requested}"`;
                        }
                    } else if (json?.detail) {
                        errorMessage += `\n\nDetails: ${json.detail}`;
                    }

                    throw new Error(errorMessage);
                }

                if (!cancelled) setData(json);
            } catch (e: any) {
                if (!cancelled) setErr(String(e?.message ?? e));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        run();
        return () => {
            cancelled = true;
        };
    }, [entryId]);

    const grouped = useMemo(() => {
        const picks = data?.picks ?? [];
        const map = new Map<string, Pick[]>();
        for (const t of TIER_ORDER) map.set(t, []);
        for (const p of picks) {
            const key = map.has(p.tier) ? p.tier : 'UNRANKED';
            map.get(key)!.push(p);
        }
        for (const [tier, arr] of map.entries()) {
            arr.sort((a, b) => {
                const ar = a.rank ?? 999;
                const br = b.rank ?? 999;
                if (ar !== br) return ar - br;
                return (a.team_name || '').localeCompare(b.team_name || '');
            });
            map.set(tier, arr);
        }
        return map;
    }, [data]);

    const shareUrl =
        typeof window !== 'undefined' && entryId
            ? `${window.location.origin}/entry/${encodeURIComponent(entryId)}`
            : '';

    const copyLink = async () => {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // ignore
        }
    };

    if (!entryId) return <div style={{ padding: 16 }}>Loading…</div>;
    if (loading) return <div style={{ padding: 16 }}>Loading entry…</div>;

    if (err) {
        return (
            <div style={ui.page}>
                <h1>Entry</h1>

                <div style={ui.errorBox}>
                    We couldn’t load this entry.
                    <br />
                    <br />
                    <strong>{err}</strong>
                </div>

                <div style={{ marginTop: 16 }}>
                    <a href="/leaderboard">View leaderboard instead →</a>
                </div>
            </div>
        );
    }

    if (!data) return <div style={{ padding: 16 }}>No entry data found.</div>;

    const entry = data.entry;

    return (
        <div style={ui.page}>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 12,
                    flexWrap: 'wrap',
                }}
            >
                <h1 style={{ margin: 0 }}>Entry {entry.entry_id}</h1>
                <div style={ui.muted}>
                    Submitted{' '}
                    {entry.created_at
                        ? new Date(entry.created_at).toLocaleString()
                        : ''}
                </div>
            </div>

            <div style={ui.card}>
                <div style={{ fontSize: 14, ...ui.muted }}>Submitted by</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                    {entry.display_name}
                </div>

                {entry.email && (
                    <div style={{ marginTop: 4, fontSize: 14, ...ui.muted }}>
                        {entry.email}
                    </div>
                )}

                <div
                    style={{
                        marginTop: 12,
                        display: 'flex',
                        gap: 10,
                        flexWrap: 'wrap',
                    }}
                >
                    <a href="/leaderboard" style={ui.btnPill}>
                        View leaderboard
                    </a>

                    <button onClick={copyLink} style={ui.btnPill}>
                        {copied ? 'Copied!' : 'Copy entry link'}
                    </button>

                    <button onClick={() => window.print()} style={ui.btnPill}>
                        Print
                    </button>
                </div>
            </div>

            <h2 style={{ marginTop: 18 }}>Picks</h2>

            <div style={{ display: 'grid', gap: 12 }}>
                {TIER_ORDER.map(tier => {
                    const picks = grouped.get(tier) ?? [];
                    return (
                        <section key={tier} style={ui.section}>
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    gap: 12,
                                }}
                            >
                                <div style={{ fontWeight: 800 }}>
                                    {TIER_LABEL[tier] ?? tier}
                                </div>
                                <div style={ui.muted}>{picks.length}/2</div>
                            </div>

                            {picks.length === 0 ? (
                                <div style={{ marginTop: 8, ...ui.muted }}>
                                    No picks in this tier.
                                </div>
                            ) : (
                                <div
                                    style={{
                                        display: 'grid',
                                        gap: 8,
                                        marginTop: 10,
                                    }}
                                >
                                    {picks.map(p => (
                                        <div key={p.team_id} style={ui.pickRow}>
                                            <div style={{ fontWeight: 700 }}>
                                                {p.team_name}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 13,
                                                    ...ui.muted,
                                                }}
                                            >
                                                {p.rank
                                                    ? `#${p.rank}`
                                                    : 'Unranked'}{' '}
                                                • {p.team_id}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    );
                })}
            </div>

            <div style={{ marginTop: 18, fontSize: 13, ...ui.muted }}>
                This entry is submit-once and cannot be edited.
            </div>
        </div>
    );
}
