// app/api/entry/[entryId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSheets, SHEET_ID } from '@/lib/sheets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type EntryRow = {
    entry_id: string;
    display_name: string;
    email: string;
    created_at: string;
    is_paid: boolean;
};

type PickRow = {
    entry_id: string;
    team_id: string;
    tier: string;
    created_at: string;
};

type TeamRow = {
    team_id: string;
    team_name: string;
    rank: number | null;
};

const toBool = (v: any) =>
    String(v ?? '')
        .trim()
        .toLowerCase() === 'true';

const toRank = (v: any) => {
    const n = Number(String(v ?? '').trim());
    return Number.isFinite(n) ? n : null;
};

export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ entryId: string }> },
) {
    try {
        const { entryId } = await context.params;
        const id = decodeURIComponent(String(entryId ?? '')).trim();

        if (!id) {
            return NextResponse.json(
                { error: 'Missing entryId.' },
                { status: 400 },
            );
        }

        const sheets = getSheets();

        // Read Entries
        const entriesRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: 'Entries!A2:Z',
        });
        const entryRows = entriesRes.data.values ?? [];

        // Expect headers like: entry_id, display_name, email, created_at, is_paid
        // Your POST currently writes: [entryId, displayName, email, nowIso, 'FALSE']
        const match = entryRows.find(r => String(r?.[0] ?? '').trim() === id);

        if (!match) {
            // Helpful debug payload (safe)
            const sampleIds = entryRows
                .slice(0, 10)
                .map(r => String(r?.[0] ?? '').trim())
                .filter(Boolean);

            return NextResponse.json(
                {
                    error: 'Not found',
                    requested: id,
                    sample_entry_ids: sampleIds,
                },
                { status: 404 },
            );
        }

        const entry: EntryRow = {
            entry_id: String(match?.[0] ?? '').trim(),
            display_name: String(match?.[1] ?? '').trim(),
            email: String(match?.[2] ?? '').trim(),
            created_at: String(match?.[3] ?? '').trim(),
            is_paid: toBool(match?.[4] ?? false),
        };

        // Read Picks
        const picksRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: 'Picks!A2:Z',
        });
        const pickRows = (picksRes.data.values ?? [])
            .map(r => ({
                entry_id: String(r?.[0] ?? '').trim(),
                team_id: String(r?.[1] ?? '').trim(),
                tier: String(r?.[2] ?? '').trim(),
                created_at: String(r?.[3] ?? '').trim(),
            }))
            .filter(r => r.entry_id === id && r.team_id);

        // Read Teams (Coaches Poll sheet) — must include team_id, team_name, rank
        // Adjust range/sheet name if yours differs
        const teamsRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: 'CoachesPoll!A2:Z',
        });
        const teamsRows = teamsRes.data.values ?? [];
        const teamMap = new Map<string, TeamRow>();
        for (const r of teamsRows) {
            const team_id = String(r?.[0] ?? '').trim();
            if (!team_id) continue;

            teamMap.set(team_id, {
                team_id,
                team_name: String(r?.[1] ?? '').trim(),
                rank: toRank(r?.[2]),
            });
        }

        const picks = pickRows.map(p => {
            const t = teamMap.get(p.team_id);
            return {
                team_id: p.team_id,
                team_name: t?.team_name ?? p.team_id,
                tier: p.tier || 'UNRANKED',
                rank: t?.rank ?? null,
            };
        });

        return NextResponse.json({ entry, picks }, { status: 200 });
    } catch (e: any) {
        return NextResponse.json(
            { error: 'Server error.', detail: String(e?.message ?? e) },
            { status: 500 },
        );
    }
}
