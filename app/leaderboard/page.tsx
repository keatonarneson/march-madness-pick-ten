'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Pick = {
    team_id: string;
    team_name: string;
    conference: string | null;
    tier: string;
    wins: number;
    rank: number | null;
};

type LeaderboardEntry = {
    entry_id: string;
    display_name: string;
    is_paid: boolean;
    points: number;
    tiebreak: {
        championOnList: number;
        unrankedWins: number;
        f4: number;
        e8: number;
        s16: number;
    };
    picks: Pick[];
};

type Payout = {
    place: number;
    pct: number;
    amount: number;
};

type LeaderboardResponse = {
    pot: number; // after fee
    paidCount: number;
    serviceFeePct?: number; // e.g. 5
    payouts: Payout[];
    rows: LeaderboardEntry[];
    show_picks?: boolean; // <- added
    lock_at?: string;
};

const ui = {
    page: {
        padding: 16,
        maxWidth: 1200,
        margin: '0 auto',
        color: 'var(--foreground)',
    } as const,
    card: {
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 16,
        background: 'var(--background)',
    } as const,
    muted: { color: 'var(--muted)' } as const,

    pillLink: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--foreground)',
        borderRadius: 999,
        padding: '8px 14px',
        fontWeight: 700,
        cursor: 'pointer',
        textDecoration: 'none',
        fontSize: 14,
        lineHeight: 1,
        whiteSpace: 'nowrap' as const,
    } as const,

    tableWrap: {
        border: '1px solid var(--border)',
        borderRadius: 16,
        overflow: 'hidden',
        background: 'var(--background)',
    } as const,

    // keep default templates here, but we'll override inline where needed
    tableHeader: {
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto auto auto auto auto auto',
        gap: 16,
        alignItems: 'center',
        fontSize: 13,
        fontWeight: 900,
        background: 'rgba(127,127,127,0.08)',
    } as const,

    row: {
        padding: '12px 16px',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto auto auto auto auto auto',
        gap: 16,
        alignItems: 'center',
        borderBottom: '1px solid rgba(127,127,127,0.18)',
    } as const,

    showBtn: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--foreground)',
        borderRadius: 999,
        padding: '6px 10px',
        fontSize: 12,
        cursor: 'pointer',
        fontWeight: 800,
        lineHeight: 1,
        whiteSpace: 'nowrap' as const,
    } as const,

    badgeUnpaid: {
        display: 'inline-block',
        marginTop: 6,
        padding: '3px 10px',
        borderRadius: 999,
        border: '1px solid rgba(255, 120, 0, 0.35)',
        background: 'rgba(255, 120, 0, 0.10)',
        color: 'var(--foreground)',
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: 0.2,
        width: 'fit-content',
    } as const,

    expandedWrap: {
        padding: '0 16px 16px 16px',
        background: 'rgba(127,127,127,0.06)',
        borderBottom: '1px solid rgba(127,127,127,0.18)',
    } as const,

    pickGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: 8,
    } as const,

    pickCard: {
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        background: 'var(--background)',
    } as const,

    payoutHighlight: {
        background: 'rgba(245, 127, 23, 0.10)',
    } as const,

    // Mobile cards
    mobileList: {
        display: 'grid',
        gap: 12,
    } as const,
    mobileCard: {
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 14,
        background: 'var(--background)',
    } as const,
    mobileTop: {
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 10,
        alignItems: 'center',
    } as const,
    mobileRank: {
        fontWeight: 900,
        fontSize: 16,
        minWidth: 42,
    } as const,
    mobilePts: {
        fontWeight: 900,
        fontSize: 18,
        textAlign: 'right' as const,
        minWidth: 40,
    } as const,
    mobileName: {
        marginTop: 10,
        fontWeight: 900,
        fontSize: 18,
        lineHeight: 1.15,
    } as const,
    mobileMeta: {
        marginTop: 6,
        fontSize: 12,
        ...({ color: 'var(--muted)' } as const),
    } as const,
    mobileTB: {
        marginTop: 12,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
    } as const,
    tbChip: {
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '8px 10px',
        textAlign: 'center' as const,
        background: 'rgba(127,127,127,0.06)',
    } as const,
    tbLabel: { fontSize: 11, ...({ color: 'var(--muted)' } as const) } as const,
    tbValue: { fontSize: 14, fontWeight: 900 } as const,
};

export default function LeaderboardPage() {
    const [data, setData] = useState<LeaderboardResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedEntries, setExpandedEntries] = useState<Set<string>>(
        new Set(),
    );

    const toggleExpanded = (entryId: string) => {
        setExpandedEntries(prev => {
            const next = new Set(prev);
            if (next.has(entryId)) next.delete(entryId);
            else next.add(entryId);
            return next;
        });
    };

    useEffect(() => {
        async function fetchLeaderboard() {
            try {
                setLoading(true);
                setError(null);
                const res = await fetch('/api/leaderboard', {
                    cache: 'no-store',
                });
                const json = await res.json();
                if (!res.ok)
                    throw new Error(
                        json?.error || 'Failed to load leaderboard',
                    );
                setData(json);
            } catch (e: any) {
                setError(String(e?.message ?? e));
            } finally {
                setLoading(false);
            }
        }
        fetchLeaderboard();
    }, []);

    const getPositionSuffix = (position: number) => {
        if (position === 1) return 'st';
        if (position === 2) return 'nd';
        if (position === 3) return 'rd';
        return 'th';
    };

    const getTierLabel = (tier: string) => {
        const tierLabels: Record<string, string> = {
            TOP_1_5: 'Top 1–5',
            TOP_6_10: 'Ranks 6–10',
            TOP_11_15: 'Ranks 11–15',
            TOP_16_25: 'Ranks 16–25',
            UNRANKED: 'Unranked',
        };
        return tierLabels[tier] || tier;
    };

    const unpaidCount = useMemo(() => {
        if (!data) return 0;
        return Math.max(0, data.rows.length - data.paidCount);
    }, [data]);

    const fmtMoney = (n: number) =>
        n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

    if (loading) {
        return (
            <div style={{ ...ui.page, textAlign: 'center' }}>
                <h1 style={{ margin: 0 }}>Leaderboard</h1>
                <div style={{ marginTop: 10, ...ui.muted }}>Loading…</div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ ...ui.page, maxWidth: 900 }}>
                <h1 style={{ margin: 0 }}>Leaderboard</h1>
                <div
                    style={{
                        marginTop: 16,
                        borderRadius: 12,
                        padding: 12,
                        border: '1px solid rgba(255,0,0,0.25)',
                        background: 'rgba(255,0,0,0.08)',
                    }}
                >
                    <b>Error:</b> {error}
                </div>
                <div style={{ marginTop: 16 }}>
                    <Link href="/" style={ui.pillLink}>
                        ← Back to Home
                    </Link>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div style={{ ...ui.page, textAlign: 'center' }}>
                <h1 style={{ margin: 0 }}>Leaderboard</h1>
                <div style={{ marginTop: 10, ...ui.muted }}>
                    No data available
                </div>
            </div>
        );
    }

    // New: read show_picks from API (default true)
    const showPicks = data.show_picks ?? true;
    const isLocked = data.lock_at
        ? Date.now() >= Date.parse(data.lock_at)
        : false;

    // helper templates for grid columns
    const desktopGridCols = showPicks
        ? 'auto 1fr auto auto auto auto auto auto'
        : 'auto 1fr auto auto auto auto auto';
    const rowBaseStyle = (isPayout: boolean) => ({
        ...ui.row,
        gridTemplateColumns: desktopGridCols,
        ...(isPayout ? ui.payoutHighlight : null),
    });
    const headerStyle = {
        ...ui.tableHeader,
        gridTemplateColumns: desktopGridCols,
    };

    return (
        <div style={ui.page}>
            {/* Local CSS to switch layouts */}
            <style jsx>{`
                .desktopOnly {
                    display: block;
                }
                .mobileOnly {
                    display: none;
                }
                @media (max-width: 720px) {
                    .desktopOnly {
                        display: none;
                    }
                    .mobileOnly {
                        display: block;
                    }
                }
            `}</style>

            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    flexWrap: 'wrap',
                    gap: 16,
                    marginBottom: 16,
                }}
            >
                <h1 style={{ margin: 0 }}>Leaderboard</h1>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Link href="/" style={ui.pillLink}>
                        ← Back to Home
                    </Link>
                    {!isLocked && (
                        <Link href="/create" style={ui.pillLink}>
                            Submit Entry
                        </Link>
                    )}
                </div>
            </div>

            {/* Paid/unpaid note */}
            {data.paidCount > 0 && data.rows.length > data.paidCount && (
                <div
                    style={{
                        ...ui.card,
                        marginBottom: 16,
                        background: 'rgba(245, 127, 23, 0.10)',
                        border: '1px solid rgba(245, 127, 23, 0.25)',
                    }}
                >
                    <div style={{ fontSize: 14 }}>
                        <b>ℹ️ Paid entries:</b> {data.paidCount} •{' '}
                        <b>Unpaid:</b> {unpaidCount} • <b>Total:</b>{' '}
                        {data.rows.length}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13, ...ui.muted }}>
                        Only paid entries are eligible for prizes.
                    </div>
                </div>
            )}

            {/* Prize Pool */}
            <div style={{ ...ui.card, marginBottom: 16 }}>
                <h2 style={{ margin: '0 0 12px 0', fontSize: 18 }}>
                    Prize Pool
                </h2>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns:
                            'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: 16,
                        alignItems: 'start',
                    }}
                >
                    <div>
                        <div style={{ fontSize: 28, fontWeight: 900 }}>
                            ${data.pot}
                        </div>

                        <div style={{ fontSize: 13, ...ui.muted }}>
                            Total prize pool ({data.paidCount} paid entries)
                            {typeof data.serviceFeePct === 'number' &&
                                data.serviceFeePct > 0 && (
                                    <>
                                        {' '}
                                        — Calculated after a{' '}
                                        {data.serviceFeePct
                                            .toFixed(2)
                                            .replace(/\.00$/, '')}
                                        % service fee
                                    </>
                                )}
                        </div>
                    </div>

                    <div>
                        <div style={{ fontSize: 13, fontWeight: 900 }}>
                            Payouts
                        </div>
                        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                            {data.payouts.map(p => (
                                <div
                                    key={p.place}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr auto',
                                        gap: 10,
                                        fontSize: 13,
                                        alignItems: 'baseline',
                                    }}
                                >
                                    <div style={ui.muted}>
                                        {p.place}
                                        {getPositionSuffix(p.place)} place (
                                        {Math.round(p.pct * 100)}
                                        %)
                                    </div>
                                    <div style={{ fontWeight: 900 }}>
                                        {fmtMoney(p.amount)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* DESKTOP TABLE */}
            <div className="desktopOnly">
                <div style={ui.tableWrap}>
                    <div style={headerStyle}>
                        <div>Rank</div>
                        <div>Entry</div>
                        <div>Pts</div>
                        <div title="Champion on list">🏆</div>
                        <div title="Unranked wins">UR</div>
                        <div title="Final Four teams">F4</div>
                        <div title="Elite Eight teams">E8</div>
                        {showPicks && <div>Picks</div>}
                    </div>

                    {data.rows.map((entry, idx) => {
                        const position = idx + 1;
                        const isPayout = position <= data.payouts.length;
                        const isExpanded = expandedEntries.has(entry.entry_id);

                        return (
                            <div key={entry.entry_id}>
                                <div style={rowBaseStyle(isPayout)}>
                                    <div
                                        style={{
                                            fontWeight: 900,
                                            minWidth: 42,
                                        }}
                                    >
                                        #{position}
                                    </div>

                                    <div>
                                        {showPicks ? (
                                            <Link
                                                href={`/entry/${encodeURIComponent(entry.entry_id)}`}
                                                style={{
                                                    textDecoration: 'none',
                                                    fontWeight: 900,
                                                    color: 'var(--link)',
                                                }}
                                            >
                                                {entry.display_name}
                                            </Link>
                                        ) : (
                                            <span style={{ fontWeight: 900 }}>
                                                {entry.display_name}
                                            </span>
                                        )}
                                        <div
                                            style={{
                                                marginTop: 3,
                                                fontSize: 12,
                                                ...ui.muted,
                                            }}
                                        >
                                            {entry.entry_id}
                                        </div>
                                        {!entry.is_paid && (
                                            <div style={ui.badgeUnpaid}>
                                                UNPAID
                                            </div>
                                        )}
                                    </div>

                                    <div
                                        style={{
                                            fontWeight: 900,
                                            fontSize: 18,
                                            textAlign: 'center',
                                        }}
                                    >
                                        {entry.points}
                                    </div>

                                    <div style={{ textAlign: 'center' }}>
                                        {entry.tiebreak.championOnList > 0
                                            ? '✅'
                                            : '—'}
                                    </div>
                                    <div
                                        style={{
                                            textAlign: 'center',
                                            fontWeight: 900,
                                        }}
                                    >
                                        {entry.tiebreak.unrankedWins}
                                    </div>
                                    <div
                                        style={{
                                            textAlign: 'center',
                                            fontWeight: 900,
                                        }}
                                    >
                                        {entry.tiebreak.f4}
                                    </div>
                                    <div
                                        style={{
                                            textAlign: 'center',
                                            fontWeight: 900,
                                        }}
                                    >
                                        {entry.tiebreak.e8}
                                    </div>

                                    {showPicks ? (
                                        <div style={{ textAlign: 'right' }}>
                                            <button
                                                onClick={() =>
                                                    toggleExpanded(
                                                        entry.entry_id,
                                                    )
                                                }
                                                style={ui.showBtn}
                                            >
                                                {isExpanded ? 'Hide' : 'Show'} (
                                                {entry.picks?.length || 0})
                                            </button>
                                        </div>
                                    ) : null}
                                </div>

                                {showPicks && isExpanded && (
                                    <div style={ui.expandedWrap}>
                                        <div
                                            style={{
                                                margin: '12px 0 10px 0',
                                                fontWeight: 900,
                                                fontSize: 13,
                                            }}
                                        >
                                            {entry.display_name}'s picks
                                        </div>

                                        {entry.picks?.length ? (
                                            <div style={ui.pickGrid}>
                                                {entry.picks.map(pick => (
                                                    <div
                                                        key={`${entry.entry_id}-${pick.team_id}-${pick.tier}`}
                                                        style={ui.pickCard}
                                                    >
                                                        <div>
                                                            <div
                                                                style={{
                                                                    fontWeight: 900,
                                                                }}
                                                            >
                                                                {pick.team_name}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    marginTop: 3,
                                                                    fontSize: 12,
                                                                    ...ui.muted,
                                                                }}
                                                            >
                                                                {pick.conference ??
                                                                    '—'}{' '}
                                                                •{' '}
                                                                {getTierLabel(
                                                                    pick.tier,
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div
                                                            style={{
                                                                fontWeight: 900,
                                                            }}
                                                        >
                                                            {pick.wins} pts
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div
                                                style={{
                                                    ...ui.muted,
                                                    fontSize: 13,
                                                }}
                                            >
                                                Picks will be shown after the
                                                lock date.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {data.rows.length === 0 && (
                        <div
                            style={{
                                padding: 24,
                                textAlign: 'center',
                                ...ui.muted,
                            }}
                        >
                            No entries found.
                        </div>
                    )}
                </div>
            </div>

            {/* MOBILE CARDS */}
            <div className="mobileOnly">
                <div style={ui.mobileList}>
                    {data.rows.map((entry, idx) => {
                        const position = idx + 1;
                        const isPayout = position <= data.payouts.length;
                        const isExpanded = expandedEntries.has(entry.entry_id);

                        return (
                            <div
                                key={entry.entry_id}
                                style={{
                                    ...ui.mobileCard,
                                    ...(isPayout ? ui.payoutHighlight : null),
                                }}
                            >
                                <div style={ui.mobileTop}>
                                    <div style={ui.mobileRank}>#{position}</div>

                                    {showPicks ? (
                                        <button
                                            onClick={() =>
                                                toggleExpanded(entry.entry_id)
                                            }
                                            style={{
                                                ...ui.showBtn,
                                                width: '100%',
                                                justifySelf: 'stretch',
                                            }}
                                        >
                                            {isExpanded
                                                ? 'Hide picks'
                                                : 'Show picks'}{' '}
                                            ({entry.picks?.length || 0})
                                        </button>
                                    ) : null}

                                    <div style={ui.mobilePts}>
                                        {entry.points}
                                    </div>
                                </div>

                                <div style={ui.mobileName}>
                                    {showPicks ? (
                                        <Link
                                            href={`/entry/${encodeURIComponent(entry.entry_id)}`}
                                            style={{
                                                textDecoration: 'none',
                                                color: 'var(--link)',
                                            }}
                                        >
                                            {entry.display_name}
                                        </Link>
                                    ) : (
                                        <span style={{ fontWeight: 900 }}>
                                            {entry.display_name}
                                        </span>
                                    )}
                                </div>

                                <div style={ui.mobileMeta}>
                                    {entry.entry_id}
                                </div>
                                {!entry.is_paid && (
                                    <div style={ui.badgeUnpaid}>UNPAID</div>
                                )}

                                <div style={ui.mobileTB}>
                                    <div style={ui.tbChip}>
                                        <div style={ui.tbLabel}>🏆</div>
                                        <div style={ui.tbValue}>
                                            {entry.tiebreak.championOnList > 0
                                                ? 'Yes'
                                                : '—'}
                                        </div>
                                    </div>
                                    <div style={ui.tbChip}>
                                        <div style={ui.tbLabel}>UR</div>
                                        <div style={ui.tbValue}>
                                            {entry.tiebreak.unrankedWins}
                                        </div>
                                    </div>
                                    <div style={ui.tbChip}>
                                        <div style={ui.tbLabel}>F4</div>
                                        <div style={ui.tbValue}>
                                            {entry.tiebreak.f4}
                                        </div>
                                    </div>
                                    <div style={ui.tbChip}>
                                        <div style={ui.tbLabel}>E8</div>
                                        <div style={ui.tbValue}>
                                            {entry.tiebreak.e8}
                                        </div>
                                    </div>
                                </div>

                                {showPicks && isExpanded && (
                                    <div style={{ marginTop: 12 }}>
                                        {entry.picks?.length ? (
                                            <div
                                                style={{
                                                    display: 'grid',
                                                    gap: 8,
                                                }}
                                            >
                                                {entry.picks.map(pick => (
                                                    <div
                                                        key={`${entry.entry_id}-${pick.team_id}-${pick.tier}`}
                                                        style={ui.pickCard}
                                                    >
                                                        <div
                                                            style={{
                                                                minWidth: 0,
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    fontWeight: 900,
                                                                }}
                                                            >
                                                                {pick.team_name}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    marginTop: 3,
                                                                    fontSize: 12,
                                                                    ...ui.muted,
                                                                }}
                                                            >
                                                                {pick.conference ??
                                                                    '—'}{' '}
                                                                •{' '}
                                                                {getTierLabel(
                                                                    pick.tier,
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div
                                                            style={{
                                                                fontWeight: 900,
                                                                whiteSpace:
                                                                    'nowrap',
                                                            }}
                                                        >
                                                            {pick.wins} pts
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div
                                                style={{
                                                    ...ui.muted,
                                                    fontSize: 13,
                                                }}
                                            >
                                                No picks found.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Legend */}
            <div style={{ ...ui.card, marginTop: 16 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>
                    Tiebreakers (in order)
                </div>
                <div
                    style={{
                        display: 'grid',
                        gap: 4,
                        fontSize: 13,
                        ...ui.muted,
                    }}
                >
                    <div>1. Total points</div>
                    <div>2. Championship team on your list (🏆)</div>
                    <div>3. Points from unranked teams (UR)</div>
                    <div>4. Final Four teams (F4)</div>
                    <div>5. Elite Eight teams (E8)</div>
                    <div>6. Sweet Sixteen teams (S16)</div>
                </div>
            </div>
        </div>
    );
}
