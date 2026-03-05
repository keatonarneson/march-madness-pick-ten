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

let showPicks = true;

export async function GET() {
    try {
        // More robust config reading with fallbacks
        let config;
        let showUnpaid = true; // Default to showing unpaid entries if config is missing

        try {
            config = await readConfig();
            showUnpaid =
                String(
                    config.show_unpaid_on_leaderboard ?? 'TRUE',
                ).toLowerCase() === 'true';

            showPicks =
                String(config.show_picks ?? 'TRUE').toLowerCase() === 'true';
        } catch (configError) {
            console.log('Config sheet error, using defaults:', configError);
            config = { entry_fee: '20' }; // Default entry fee
            showUnpaid = true; // Show all entries by default when config is missing
            showPicks = true;
        }

        const sheets = getSheets();

        const [entriesRes, picksRes, teamsRes] = await Promise.all([
            sheets.spreadsheets.values.get({
                spreadsheetId: SHEET_ID,
                range: 'Entries!A:E', // Extended to include is_paid column
            }),
            sheets.spreadsheets.values.get({
                spreadsheetId: SHEET_ID,
                range: 'Picks!A:D',
            }),
            sheets.spreadsheets.values
                .get({
                    spreadsheetId: SHEET_ID,
                    range: 'Teams!A:Z',
                })
                .catch(() => ({ data: { values: [] } })), // Fallback if Teams sheet doesn't exist
        ]);

        // More robust results reading with fallback
        let results;
        try {
            results = await readResults();
        } catch (resultsError) {
            console.log(
                'Results sheet error, using empty results:',
                resultsError,
            );
            results = new Map(); // Empty results map if sheet doesn't exist
        }

        const entriesRows = (entriesRes.data.values ?? []).slice(1);
        const picksRows = (picksRes.data.values ?? []).slice(1);
        const teamsRows = (teamsRes.data.values ?? []).slice(1);

        // Build team name + conference mappings
        const teamNameById = new Map<string, string>();
        const teamConferenceById = new Map<string, string>();

        for (const r of teamsRows) {
            const teamId = String(r?.[0] ?? '').trim();
            const teamName = String(r?.[1] ?? '').trim();
            const conference = String(r?.[2] ?? '').trim(); // <-- column C

            if (!teamId) continue;
            if (teamName) teamNameById.set(teamId, teamName);
            if (conference) teamConferenceById.set(teamId, conference);
        }

        const entries = entriesRows
            .map(r => ({
                entry_id: String(r?.[0] ?? ''),
                display_name: String(r?.[1] ?? ''),
                email: String(r?.[2] ?? ''),
                created_at: String(r?.[3] ?? ''),
                is_paid: String(r?.[4] ?? '').toLowerCase() === 'true', // Column E
            }))
            .filter(e => e.entry_id);

        console.log(
            'Entries with payment status:',
            entries.map(e => ({
                entry_id: e.entry_id,
                display_name: e.display_name,
                is_paid: e.is_paid,
                raw_payment_value: String(
                    entriesRows.find(r => r[0] === e.entry_id)?.[4] ??
                        'not found',
                ),
            })),
        );

        const picksByEntry = new Map<
            string,
            {
                team_id: string;
                team_name: string;
                conference: string | null; // ✅ added
                tier: string;
                wins: number;
                rank: number | null;
            }[]
        >();

        for (const r of picksRows) {
            const entry_id = String(r?.[0] ?? '').trim();
            const team_id = String(r?.[1] ?? '').trim();
            const tier = String(r?.[2] ?? '').trim();
            if (!entry_id || !team_id) continue;

            const arr = picksByEntry.get(entry_id) ?? [];
            const teamResult = results.get(team_id);

            arr.push({
                team_id,
                team_name: teamNameById.get(team_id) ?? team_id,
                conference: teamConferenceById.get(team_id) ?? null, // ✅ added
                tier,
                wins: teamResult?.wins ?? 0,
                rank: null, // Will be filled from coaches poll if available
            });

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
                    picks: showPicks
                        ? picks.sort((a, b) => {
                              const tierOrder = [
                                  'TOP_1_5',
                                  'TOP_6_10',
                                  'TOP_11_15',
                                  'TOP_16_25',
                                  'UNRANKED',
                              ];
                              const aTierIndex = tierOrder.indexOf(a.tier);
                              const bTierIndex = tierOrder.indexOf(b.tier);
                              if (aTierIndex !== bTierIndex)
                                  return aTierIndex - bTierIndex;
                              return a.team_name.localeCompare(b.team_name);
                          })
                        : [],
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

        const entryFee = Number(config.entry_fee ?? 20);
        const entryFeeSafe = Number.isFinite(entryFee) ? entryFee : 20;

        // service_fee is stored like 0.05 in the sheet
        const serviceFeeDecimal = Number(config.service_fee ?? 0);
        const serviceFeeDecimalSafe = Number.isFinite(serviceFeeDecimal)
            ? Math.min(Math.max(serviceFeeDecimal, 0), 1)
            : 0;

        const serviceFeePct = serviceFeeDecimalSafe * 100;

        const grossPot = paidCount * entryFeeSafe;
        const netPot =
            Math.round(grossPot * (1 - serviceFeeDecimalSafe) * 100) / 100;

        const payoutDefs = [
            { place: 1, pct: 0.45 },
            { place: 2, pct: 0.25 },
            { place: 3, pct: 0.15 },
            { place: 4, pct: 0.1 },
            { place: 5, pct: 0.05 },
        ];

        const payouts = payoutDefs.map(p => ({
            ...p,
            amount: Math.round(netPot * p.pct * 100) / 100,
        }));

        const pot = netPot; // keep response shape: pot = displayed prize pool (after fee)

        return NextResponse.json(
            {
                pot,
                paidCount,
                payouts,
                rows,
                serviceFeePct,
                show_picks: showPicks,
                debug: {
                    totalEntriesFromSheet: entries.length,
                    showUnpaid,
                    configExists: !!config.show_unpaid_on_leaderboard,
                    entriesBeforeFilter: entries.length,
                    entriesAfterFilter: rows.length,
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
