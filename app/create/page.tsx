'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Team = {
    team_id: string;
    team_name: string;
    conference?: string;
    rank?: number;
};

type PollResponse = {
    top_1_5: Team[];
    top_6_10: Team[];
    top_11_15: Team[];
    top_16_25: Team[];
    unranked: Team[];
};

type BucketKey = keyof PollResponse;

const BUCKETS: { key: BucketKey; label: string }[] = [
    { key: 'top_1_5', label: 'Top 1–5 (pick 2)' },
    { key: 'top_6_10', label: 'Ranks 6–10 (pick 2)' },
    { key: 'top_11_15', label: 'Ranks 11–15 (pick 2)' },
    { key: 'top_16_25', label: 'Ranks 16–25 (pick 2)' },
    { key: 'unranked', label: 'Unranked (pick 2)' },
];

// Theme-safe UI tokens (works with your globals.css vars)
const ui = {
    card: {
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: 10,
        background: 'var(--background)',
    } as const,
    button: {
        textAlign: 'left' as const,
        padding: '8px 10px',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--background)',
        cursor: 'pointer',
        color: 'var(--foreground)',
    } as const,
    buttonSelected: {
        background: 'rgba(0, 160, 70, 0.18)', // readable in light/dark
    } as const,
    subText: {
        fontSize: 12,
        color: 'var(--muted)',
    } as const,
    label: {
        display: 'block',
        fontWeight: 600,
        marginBottom: 6,
    } as const,
    input: {
        width: '100%',
        padding: 10,
        fontSize: 16,
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--background)',
        color: 'var(--foreground)',
    } as const,
    errorBox: {
        background: 'rgba(255, 0, 0, 0.08)',
        border: '1px solid rgba(255, 0, 0, 0.25)',
        padding: 10,
        marginBottom: 12,
        borderRadius: 10,
        color: 'var(--foreground)',
        whiteSpace: 'pre-line' as const,
    },
    submitBtn: (enabled: boolean) =>
        ({
            padding: '12px 16px',
            fontSize: 16,
            borderRadius: 10,
            border: '1px solid var(--foreground)',
            background: enabled ? 'var(--foreground)' : 'var(--border)',
            color: enabled ? 'var(--background)' : 'var(--muted)',
            cursor: enabled ? 'pointer' : 'not-allowed',
        }) as const,
};

export default function CreatePage() {
    const router = useRouter();

    const [poll, setPoll] = useState<PollResponse | null>(null);
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [selected, setSelected] = useState<Record<BucketKey, string[]>>({
        top_1_5: [],
        top_6_10: [],
        top_11_15: [],
        top_16_25: [],
        unranked: [],
    });
    const [unrankedQuery, setUnrankedQuery] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/poll')
            .then(r => r.json())
            .then(setPoll)
            .catch(e => setError(String(e)));
    }, []);

    const totalCount = Object.values(selected).reduce(
        (sum, arr) => sum + arr.length,
        0,
    );

    const canSubmit =
        displayName.trim().length > 0 &&
        email.trim().includes('@') &&
        BUCKETS.every(b => selected[b.key].length === 2);

    const togglePick = (bucket: BucketKey, teamId: string) => {
        setError(null);
        setSelected(prev => {
            const cur = prev[bucket];
            const has = cur.includes(teamId);
            if (has)
                return { ...prev, [bucket]: cur.filter(x => x !== teamId) };
            if (cur.length >= 2) return prev; // cap at 2
            return { ...prev, [bucket]: [...cur, teamId] };
        });
    };

    const allTeamIds = useMemo(() => {
        const arr: string[] = [];
        for (const key of Object.keys(selected) as BucketKey[])
            arr.push(...selected[key]);
        return arr;
    }, [selected]);

    // Keep unranked alphabetical (by team_name), but still filter and keep selected first.
    const unrankedFiltered = useMemo(() => {
        if (!poll) return [];

        const query = unrankedQuery.trim().toLowerCase();

        const filtered = poll.unranked
            .filter(t => {
                if (!query) return true;
                const name = (t.team_name || '').toLowerCase();
                const conf = (t.conference || '').toLowerCase();
                return name.includes(query) || conf.includes(query);
            })
            .slice()
            .sort((a, b) =>
                (a.team_name || '').localeCompare(b.team_name || ''),
            );

        const selectedSet = new Set(selected.unranked);
        const selectedTeams = filtered.filter(t => selectedSet.has(t.team_id));
        const unselectedTeams = filtered.filter(
            t => !selectedSet.has(t.team_id),
        );

        return [...selectedTeams, ...unselectedTeams];
    }, [poll, unrankedQuery, selected.unranked]);

    const submit = async () => {
        setSubmitting(true);
        setError(null);

        try {
            const res = await fetch('/api/entry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    displayName,
                    email,
                    teamIds: allTeamIds,
                }),
            });

            const data = await res.json();
            console.log('POST /api/entry response:', data);

            if (!res.ok) throw new Error(data?.error ?? 'Submission failed');

            const entryId = data?.entryId ?? data?.entry_id ?? data?.id;
            if (!entryId)
                throw new Error(
                    `Missing entry id in response: ${JSON.stringify(data)}`,
                );

            router.push(`/entry/${entryId}`);
        } catch (e: any) {
            setError(String(e?.message ?? e));
        } finally {
            setSubmitting(false);
        }
    };

    if (!poll) return <div style={{ padding: 16 }}>Loading…</div>;

    return (
        <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
            <h1>March Madness Pool — Pick 10 Teams</h1>

            <div style={{ margin: '12px 0' }}>
                <label style={ui.label}>Your name (as it should appear)</label>
                <input
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Enter display name"
                    style={ui.input}
                />
            </div>

            <div style={{ margin: '12px 0' }}>
                <label style={ui.label}>Email address</label>
                <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    style={ui.input}
                />
            </div>

            {error && <div style={ui.errorBox}>{error}</div>}

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 12,
                }}
            >
                {BUCKETS.slice(0, 4).map(({ key, label }) => (
                    <div key={key} style={ui.card}>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>
                            {label} — {selected[key].length}/2
                        </div>

                        <div style={{ display: 'grid', gap: 6 }}>
                            {poll[key].map(t => {
                                const checked = selected[key].includes(
                                    t.team_id,
                                );

                                return (
                                    <button
                                        key={t.team_id}
                                        onClick={() =>
                                            togglePick(key, t.team_id)
                                        }
                                        style={{
                                            ...ui.button,
                                            ...(checked
                                                ? ui.buttonSelected
                                                : null),
                                        }}
                                        type="button"
                                    >
                                        <div style={{ fontWeight: 600 }}>
                                            {t.rank != null
                                                ? `#${t.rank} `
                                                : ''}
                                            {t.team_name}
                                        </div>
                                        <div style={ui.subText}>
                                            {t.conference || '—'}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {/* Unranked bucket */}
                <div style={ui.card}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                        Unranked (pick 2) — {selected.unranked.length}/2
                    </div>

                    <input
                        value={unrankedQuery}
                        onChange={e => setUnrankedQuery(e.target.value)}
                        placeholder="Search unranked…"
                        style={{
                            ...ui.input,
                            fontSize: 14,
                            padding: 8,
                            marginBottom: 8,
                        }}
                    />

                    <div
                        style={{
                            display: 'grid',
                            gap: 6,
                            maxHeight: 520,
                            overflow: 'auto',
                        }}
                    >
                        {unrankedFiltered.slice(0, 200).map(t => {
                            const checked = selected.unranked.includes(
                                t.team_id,
                            );

                            return (
                                <button
                                    key={t.team_id}
                                    onClick={() =>
                                        togglePick('unranked', t.team_id)
                                    }
                                    style={{
                                        ...ui.button,
                                        ...(checked ? ui.buttonSelected : null),
                                    }}
                                    type="button"
                                >
                                    <div style={{ fontWeight: 600 }}>
                                        {t.team_name}
                                    </div>
                                    <div style={ui.subText}>
                                        {t.conference || '—'}
                                    </div>
                                </button>
                            );
                        })}

                        {unrankedFiltered.length > 200 && (
                            <div
                                style={{ fontSize: 12, color: 'var(--muted)' }}
                            >
                                Showing first 200 results. Refine your search.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div
                style={{
                    marginTop: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                }}
            >
                <button
                    onClick={submit}
                    disabled={!canSubmit || submitting}
                    style={ui.submitBtn(canSubmit && !submitting)}
                    type="button"
                >
                    {submitting ? 'Submitting…' : 'Submit Entry'}
                </button>

                <div style={{ color: 'var(--muted)' }}>
                    Total selected:{' '}
                    <b style={{ color: 'var(--foreground)' }}>
                        {totalCount}/10
                    </b>
                </div>
            </div>

            <p style={{ marginTop: 10, fontSize: 13, color: 'var(--muted)' }}>
                Submit once: after you submit, your entry cannot be edited.
            </p>
        </div>
    );
}
