// app/api/entry/[entryId]/route.ts
import { NextResponse } from 'next/server';
import { getSheets, SHEET_ID } from '@/lib/sheets';
import { readCoachesPoll } from '@/lib/poolData';

export const runtime = 'nodejs';

type Row = (string | undefined)[];

function headerIndex(headers: Row, name: string) {
    const idx = headers.findIndex(
        h =>
            String(h ?? '')
                .trim()
                .toLowerCase() === name.toLowerCase(),
    );
    return idx >= 0 ? idx : null;
}

function cell(row: Row, idx: number | null) {
    if (idx === null) return '';
    return String(row[idx] ?? '').trim();
}

export async function GET(
    request: Request,
    { params }: { params: { entryId: string } },
) {
    try {
        // Multiple approaches to extract the entry ID
        let entryId: string | null = null;

        // Method 1: From params object
        if (params?.entryId) {
            entryId = params.entryId;
        }

        // Method 2: Extract from URL as fallback
        if (!entryId) {
            const url = new URL(request.url);
            const pathSegments = url.pathname.split('/');
            const entryIndex = pathSegments.indexOf('entry');
            if (entryIndex !== -1 && pathSegments[entryIndex + 1]) {
                entryId = pathSegments[entryIndex + 1];
            }
        }

        // Method 3: Try await params in case it's a Promise (Next.js 15+)
        if (!entryId) {
            try {
                const resolvedParams = await Promise.resolve(params);
                entryId = resolvedParams?.entryId;
            } catch (e) {
                // Not a promise, ignore
            }
        }

        if (!entryId) {
            return NextResponse.json(
                {
                    error: 'Entry ID parameter is missing',
                    debug: {
                        params: params,
                        paramsKeys: Object.keys(params || {}),
                        url: request.url,
                        pathname: new URL(request.url).pathname,
                        pathSegments: new URL(request.url).pathname.split('/'),
                    },
                },
                { status: 400 },
            );
        }

        // Clean up the entry ID
        entryId = decodeURIComponent(entryId).trim();

        if (!entryId) {
            return NextResponse.json(
                {
                    error: 'Entry ID is empty after processing',
                    debug: {
                        originalParams: params,
                        extractedEntryId: entryId,
                    },
                },
                { status: 400 },
            );
        }

        const sheets = getSheets();

        const [entriesRes, picksRes, teamsRes] = await Promise.all([
            // Use a wide range so column changes don't break things
            sheets.spreadsheets.values.get({
                spreadsheetId: SHEET_ID,
                range: 'Entries!A:Z',
            }),
            sheets.spreadsheets.values.get({
                spreadsheetId: SHEET_ID,
                range: 'Picks!A:Z',
            }),
            sheets.spreadsheets.values.get({
                spreadsheetId: SHEET_ID,
                range: 'Teams!A:Z',
            }),
        ]);

        const entriesValues = entriesRes.data.values ?? [];
        const picksValues = picksRes.data.values ?? [];
        const teamsValues = teamsRes.data.values ?? [];

        if (entriesValues.length < 2) {
            return NextResponse.json(
                { error: 'Entries sheet has no data rows.' },
                { status: 500 },
            );
        }

        const entriesHeader = entriesValues[0] as Row;
        const iEntryId = headerIndex(entriesHeader, 'entry_id');
        const iDisplayName = headerIndex(entriesHeader, 'display_name');
        const iEmail = headerIndex(entriesHeader, 'email');
        const iCreatedAt = headerIndex(entriesHeader, 'created_at');
        const iIsPaid = headerIndex(entriesHeader, 'is_paid');

        if (iEntryId === null) {
            return NextResponse.json(
                {
                    error: "Entries sheet missing required column 'entry_id'.",
                    entriesHeader,
                },
                { status: 500 },
            );
        }

        const entries = entriesValues.slice(1).map(r => {
            const row = r as Row;
            const isPaidRaw = cell(row, iIsPaid).toLowerCase();
            return {
                entry_id: cell(row, iEntryId),
                display_name: cell(row, iDisplayName),
                email: cell(row, iEmail),
                created_at: cell(row, iCreatedAt),
                is_paid: isPaidRaw === 'true',
            };
        });

        const entry = entries.find(e => e.entry_id === entryId);

        if (!entry) {
            return NextResponse.json(
                {
                    error: 'Not found',
                    requested: entryId,
                    sample_entry_ids: entries
                        .map(e => e.entry_id)
                        .filter(Boolean)
                        .slice(0, 15),
                },
                { status: 404 },
            );
        }

        // Teams mapping
        const teamsHeader = (teamsValues[0] ?? []) as Row;
        const iTeamId = headerIndex(teamsHeader, 'team_id');
        const iTeamName = headerIndex(teamsHeader, 'team_name');

        const teamNameById = new Map<string, string>();
        for (const r of teamsValues.slice(1)) {
            const row = r as Row;
            const id = cell(row, iTeamId);
            const name = cell(row, iTeamName);
            if (id && name) teamNameById.set(id, name);
        }

        // Picks mapping
        const picksHeader = (picksValues[0] ?? []) as Row;
        const iPickEntryId = headerIndex(picksHeader, 'entry_id');
        const iPickTeamId = headerIndex(picksHeader, 'team_id');
        const iPickTier = headerIndex(picksHeader, 'tier');

        if (
            iPickEntryId === null ||
            iPickTeamId === null ||
            iPickTier === null
        ) {
            return NextResponse.json(
                {
                    error: "Picks sheet missing one of required columns: 'entry_id', 'team_id', 'tier'.",
                    picksHeader,
                },
                { status: 500 },
            );
        }

        const poll = await readCoachesPoll(); // team_id -> rank

        const picks = picksValues
            .slice(1)
            .map(r => r as Row)
            .filter(row => cell(row, iPickEntryId) === entryId)
            .map(row => {
                const team_id = cell(row, iPickTeamId);
                const tier = cell(row, iPickTier);
                return {
                    team_id,
                    tier,
                    team_name: teamNameById.get(team_id) ?? team_id,
                    rank: poll.get(team_id) ?? null,
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
