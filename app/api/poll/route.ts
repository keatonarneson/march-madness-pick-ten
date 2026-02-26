import { NextResponse } from 'next/server';
import { getSheets, SHEET_ID } from '@/lib/sheets';
import { readCoachesPoll } from '@/lib/poolData';

type Team = {
    team_id: string;
    team_name: string;
    conference?: string;
    rank?: number;
};

export async function GET() {
    try {
        const sheets = getSheets();

        // Load Teams tab (master list)
        // Expected columns:
        // A: team_id, B: team_name, C: conference
        const teamsRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: 'Teams!A:C',
        });

        const teamRows = (teamsRes.data.values ?? []).slice(1);
        const teams: Team[] = teamRows
            .map(r => ({
                team_id: String(r?.[0] ?? '').trim(),
                team_name: String(r?.[1] ?? '').trim(),
                conference: String(r?.[2] ?? '').trim() || undefined,
            }))
            .filter(t => t.team_id && t.team_name);

        // Load poll ranks
        const poll = await readCoachesPoll(); // team_id -> rank
        const ranked = new Map<string, number>(poll);

        const rankedTeams: Team[] = teams
            .filter(t => ranked.has(t.team_id))
            .map(t => ({ ...t, rank: ranked.get(t.team_id)! }))
            .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

        const unrankedTeams: Team[] = teams
            .filter(t => !ranked.has(t.team_id))
            .sort((a, b) => a.team_name.localeCompare(b.team_name));

        const bucket = (min: number, max: number) =>
            rankedTeams.filter(
                t => (t.rank ?? 999) >= min && (t.rank ?? 0) <= max,
            );

        return NextResponse.json(
            {
                top_1_5: bucket(1, 5),
                top_6_10: bucket(6, 10),
                top_11_15: bucket(11, 15),
                top_16_25: bucket(16, 25),
                unranked: unrankedTeams,
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
