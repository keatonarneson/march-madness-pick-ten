// app/page.tsx
import Link from 'next/link';
import { readConfig } from '@/lib/poolData';
import type { Metadata } from 'next';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'March Madness Pick-10 Pool',
    description:
        'Pick 10 teams across ranking tiers and compete for the prize pool.',
    alternates: { canonical: '/' },
    openGraph: {
        title: 'March Madness Pick-10 Pool',
        description:
            'Pick 10 teams across ranking tiers and compete for the prize pool.',
        type: 'website',
        siteName: 'Pick-10 Pool',
        url: '/',
        images: [
            {
                url: '/preview.png',
                width: 1200,
                height: 630,
                alt: 'March Madness Pick-10 Pool',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'March Madness Pick-10 Pool',
        description:
            'Pick 10 teams across ranking tiers and compete for the prize pool.',
        images: ['/preview.png'],
    },
};

/* ---------- Lock banner formatter (timezone safe, includes day) ---------- */

const fmtLockBanner = (lockMs: number) => {
    const d = new Date(lockMs);

    const fmtTime = (tz: string) =>
        new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hour: 'numeric',
            minute: '2-digit',
        }).format(d);

    const fmtDate = (tz: string) =>
        new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            weekday: 'long',
            month: 'long',
            day: 'numeric',
        }).format(d);

    // Use Central date as the "official" day
    const dateCT = fmtDate('America/Chicago');
    const ct = fmtTime('America/Chicago');
    const et = fmtTime('America/New_York');
    const pt = fmtTime('America/Los_Angeles');

    return `${dateCT} — ${ct} CT (${et} ET / ${pt} PT)`;
};

/* ---------- styles ---------- */

const styles = {
    page: {
        padding: 16,
        maxWidth: 980,
        margin: '0 auto',
    } as const,
    card: {
        border: '1px solid var(--border, rgba(0,0,0,0.15))',
        borderRadius: 16,
        padding: 16,
        background: 'var(--background)',
    } as const,
    muted: {
        opacity: 0.85,
    } as const,
    buttonPrimary: {
        display: 'inline-block',
        padding: '12px 14px',
        borderRadius: 12,
        background: 'var(--foreground)',
        color: 'var(--background)',
        textDecoration: 'none',
        fontWeight: 700,
    } as const,
    buttonSecondary: {
        display: 'inline-block',
        padding: '12px 14px',
        borderRadius: 12,
        background: 'transparent',
        color: 'var(--foreground)',
        border: '1px solid var(--border, rgba(0,0,0,0.15))',
        textDecoration: 'none',
        fontWeight: 700,
    } as const,
};

/* ---------- page ---------- */

export default async function HomePage() {
    const config = await readConfig();

    const lockRaw = String(config.lock_at ?? '').trim();

    // ensure timezone exists (fallback only if config missing it)
    const hasTz = /([zZ]|[+-]\d{2}:\d{2})$/.test(lockRaw);
    const lockIso = lockRaw && !hasTz ? `${lockRaw}-05:00` : lockRaw;

    const lockMs = lockIso ? Date.parse(lockIso) : NaN;
    const lockValid = Number.isFinite(lockMs);

    const nowMs = Date.now();
    const isLocked = lockValid ? nowMs >= lockMs : false;

    const seasonYear = String(config.season_year ?? '2026').trim();
    const pollDate = String(config.poll_date ?? '2026-03-10').trim();
    const entryFee = Number(config.entry_fee ?? 20);

    const primaryHref = isLocked ? '/leaderboard' : '/create';
    const primaryText = isLocked ? 'View Leaderboard' : 'Create Entry';

    return (
        <div style={styles.page}>
            {/* Hero */}
            <div style={styles.card}>
                <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.15 }}>
                    March Madness 10-Team Pool ({seasonYear})
                </h1>

                <p
                    style={{
                        marginTop: 10,
                        fontSize: 16,
                        ...styles.muted,
                        maxWidth: 820,
                    }}
                >
                    Pick 10 teams <b>before</b> the bracket is announced. Score
                    1 point for each tournament win your teams get (including
                    First Four).
                </p>

                {/* Status banner */}
                <div
                    style={{
                        marginTop: 12,
                        borderRadius: 12,
                        padding: 12,
                        border: '1px solid var(--border, rgba(0,0,0,0.15))',
                        background: isLocked
                            ? 'rgba(255, 0, 0, 0.08)'
                            : 'rgba(0, 160, 70, 0.10)',
                    }}
                >
                    {lockValid ? (
                        <div style={{ fontSize: 14 }}>
                            <b>{isLocked ? '🔒 Locked' : '✅ Open'}</b>
                            <span style={{ opacity: 0.85 }}>
                                {' '}
                                —{' '}
                                {isLocked
                                    ? 'Submissions locked at'
                                    : 'Submissions close at'}{' '}
                                <b>{fmtLockBanner(lockMs)}</b>
                            </span>
                        </div>
                    ) : (
                        <div style={{ fontSize: 14 }}>
                            <b>⚠️ Lock time not configured</b>
                            <span style={{ opacity: 0.85 }}>
                                {' '}
                                — Set <code>lock_at</code> on the Config sheet
                                (ISO format).
                            </span>
                        </div>
                    )}
                </div>

                {/* CTA row */}
                <div
                    style={{
                        marginTop: 14,
                        display: 'flex',
                        gap: 10,
                        flexWrap: 'wrap',
                    }}
                >
                    {!isLocked && (
                        <Link href="/create" style={styles.buttonPrimary}>
                            Create Entry
                        </Link>
                    )}

                    <Link
                        href="/leaderboard"
                        style={
                            isLocked
                                ? styles.buttonPrimary
                                : styles.buttonSecondary
                        }
                    >
                        Leaderboard
                    </Link>

                    <Link
                        href="/payment"
                        style={{
                            display: 'inline-block',
                            padding: '10px 14px',
                            borderRadius: 10,
                            border: '1px solid #ddd',
                            textDecoration: 'none',
                        }}
                    >
                        Payment Info
                    </Link>
                </div>
            </div>

            {/* How it works */}
            <div
                className="rules-grid"
                style={{
                    marginTop: 16,
                    display: 'grid',
                    gridTemplateColumns: '1fr',
                    gap: 12,
                }}
            >
                <div style={styles.card}>
                    <h2 style={{ marginTop: 0 }}>How it works</h2>
                    <p style={{ marginTop: 6, ...styles.muted }}>
                        Using the final USA Today <b>Coaches</b> poll released
                        on <b>{pollDate}</b>, choose:
                    </p>

                    <ul style={{ marginTop: 10, lineHeight: 1.7 }}>
                        <li>
                            <b>2 teams</b> from ranks <b>1–5</b>
                        </li>
                        <li>
                            <b>2 teams</b> from ranks <b>6–10</b>
                        </li>
                        <li>
                            <b>2 teams</b> from ranks <b>11–15</b>
                        </li>
                        <li>
                            <b>2 teams</b> from ranks <b>16–25</b>
                        </li>
                        <li>
                            <b>2 teams</b> <b>unranked</b> (not in the Top 25)
                        </li>
                    </ul>

                    <div style={{ marginTop: 10, fontSize: 13, opacity: 0.75 }}>
                        Submit once — entries can’t be edited after submission.
                    </div>
                </div>

                <div style={{ display: 'grid', gap: 12 }}>
                    <div style={styles.card}>
                        <h2 style={{ marginTop: 0 }}>Scoring</h2>
                        <div style={{ fontSize: 15, lineHeight: 1.6 }}>
                            <div>
                                <b>1 point</b> per win across your 10 teams
                            </div>
                            <div style={{ opacity: 0.85 }}>
                                Includes First Four games
                            </div>
                        </div>
                    </div>

                    <div style={styles.card}>
                        <h2 style={{ marginTop: 0 }}>Tiebreakers</h2>
                        <ol
                            style={{
                                margin: 0,
                                paddingLeft: 18,
                                lineHeight: 1.7,
                            }}
                        >
                            <li>Championship team on your list</li>
                            <li>Points from your unranked teams</li>
                            <li># Final Four teams on your list</li>
                            <li># Elite Eight teams on your list</li>
                            <li># Sweet Sixteen teams on your list</li>
                        </ol>
                    </div>

                    <div style={styles.card}>
                        <h2 style={{ marginTop: 0 }}>Prizes</h2>
                        <div style={{ fontSize: 15, lineHeight: 1.7 }}>
                            <div>
                                Entry fee:{' '}
                                <b>
                                    ${Number.isFinite(entryFee) ? entryFee : 20}
                                </b>{' '}
                                per entry
                            </div>
                            <div style={{ marginTop: 6, opacity: 0.9 }}>
                                Top 5 payouts:
                                <div style={{ fontSize: 14, opacity: 0.85 }}>
                                    1st 45% • 2nd 25% • 3rd 15% • 4th 10% • 5th
                                    5%
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: 16, fontSize: 13, opacity: 0.75 }}>
                Tip: after submitting, bookmark your Entry page link for easy
                reference.
            </div>
        </div>
    );
}
