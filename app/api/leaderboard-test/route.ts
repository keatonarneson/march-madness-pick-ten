import { NextResponse } from 'next/server';
import { getSheets, SHEET_ID } from '@/lib/sheets';
import { readConfig, readResults } from '@/lib/poolData';

const ROUND_RANK: Record<string, number> = {
    FIRST_FOUR: 0,
    R64: 1,
    R32: 2,
    SWEET_16: 3,
    ELITE_8: 4,
    FINAL_4: 5,
    RUNNER_UP: 6,
    CHAMPION: 7,
};

export async function GET() {
    try {
        let config;
        let showUnpaid = true; // Default to showing all entries for testing

        try {
            config = await readConfig();
            showUnpaid =
                String(
                    config.show_unpaid_on_leaderboard ?? 'TRUE',
                ).toLowerCase() === 'true';
        } catch (configError) {
            console.log(
                'Config sheet not found or error reading config, showing all entries:',
                configError,
            );
            config = { entry_fee: '20' }; // Default values
        }

        const sheets = getSheets();

        const [entriesRes, picksRes] = await Promise.all([
            sheets.spreadsheets.values.get({
                spreadsheetId: SHEET_ID,
                range: 'Entries!A:D',
            }),
            sheets.spreadsheets.values.get({
                spreadsheetId: SHEET_ID,
                range: 'Picks!A:D',
            }),
        ]);

        let results;
        try {
            results = await readResults();
        } catch (resultsError) {
            console.log(
                'Results sheet not found or error, using empty results:',
                resultsError,
            );
            results = new Map();
        }

        const entriesRows = (entriesRes.data.values ?? []).slice(1);
        const picksRows = (picksRes.data.values ?? []).slice(1);

        const entries = entriesRows
            .map(r => ({
                entry_id: String(r[0] ?? ''),
                display_name: String(r[1] ?? ''),
                created_at: String(r[2] ?? ''),
                is_paid: String(r[3] ?? '').toLowerCase() === 'true',
            }))
            .filter(e => e.entry_id);

        const picksByEntry = new Map<
            string,
            { team_id: string; tier: string }[]
        >();
        for (const r of picksRows) {
            const entry_id = String(r[0] ?? '').trim();
            const team_id = String(r[1] ?? '').trim();
            const tier = String(r[2] ?? '').trim();
            if (!entry_id || !team_id) continue;
            const arr = picksByEntry.get(entry_id) ?? [];
            arr.push({ team_id, tier });
            picksByEntry.set(entry_id, arr);
        }

        const rows = entries
            .filter(e => showUnpaid || e.is_paid)
            .map(e => {
                const picks = picksByEntry.get(e.entry_id) ?? [];
                let total = 0;
                let unrankedWins = 0;
                let championOnList = 0;
                let f4 = 0,
                    e8 = 0,
                    s16 = 0;

                for (const p of picks) {
                    const tr = results.get(p.team_id);
                    const wins = tr?.wins ?? 0;
                    total += wins;
                    if (p.tier === 'UNRANKED') unrankedWins += wins;
                    if (tr?.is_champion) championOnList = 1;

                    const rr = ROUND_RANK[tr?.max_round ?? ''] ?? -1;
                    if (rr >= ROUND_RANK.FINAL_4) f4 += 1;
                    if (rr >= ROUND_RANK.ELITE_8) e8 += 1;
                    if (rr >= ROUND_RANK.SWEET_16) s16 += 1;
                }

                return {
                    entry_id: e.entry_id,
                    display_name: e.display_name,
                    is_paid: e.is_paid,
                    points: total,
                    tiebreak: { championOnList, unrankedWins, f4, e8, s16 },
                };
            })
            .sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                if (b.tiebreak.championOnList !== a.tiebreak.championOnList)
                    return (
                        b.tiebreak.championOnList - a.tiebreak.championOnList
                    );
                if (b.tiebreak.unrankedWins !== a.tiebreak.unrankedWins)
                    return b.tiebreak.unrankedWins - a.tiebreak.unrankedWins;
                if (b.tiebreak.f4 !== a.tiebreak.f4)
                    return b.tiebreak.f4 - a.tiebreak.f4;
                if (b.tiebreak.e8 !== a.tiebreak.e8)
                    return b.tiebreak.e8 - a.tiebreak.e8;
                if (b.tiebreak.s16 !== a.tiebreak.s16)
                    return b.tiebreak.s16 - a.tiebreak.s16;
                return a.entry_id.localeCompare(b.entry_id);
            });

        // payouts
        const paidCount = entries.filter(e => e.is_paid).length;
        const fee = Number(config.entry_fee ?? 20);
        const pot = paidCount * (Number.isFinite(fee) ? fee : 20);
        const payouts = [
            { place: 1, pct: 0.45 },
            { place: 2, pct: 0.25 },
            { place: 3, pct: 0.15 },
            { place: 4, pct: 0.1 },
            { place: 5, pct: 0.05 },
        ].map(p => ({ ...p, amount: Math.round(pot * p.pct * 100) / 100 }));

        return NextResponse.json(
            {
                pot,
                paidCount,
                payouts,
                rows,
                debug: {
                    totalEntries: entries.length,
                    showUnpaid,
                    configFound: !!config.show_unpaid_on_leaderboard,
                },
            },
            { status: 200 },
        );
    } catch (e: any) {
        return NextResponse.json(
            { error: 'Server error.', detail: String(e?.message ?? e) },
            { status: 500 },
        );
    }
}
