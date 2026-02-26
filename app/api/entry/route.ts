import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSheets, SHEET_ID } from '@/lib/sheets';
import { readConfig, readCoachesPoll, tierForRank } from '@/lib/poolData';

function makeEntryId(seasonYear: string) {
    // random, no contention
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `E${seasonYear}-${rand}`;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const displayName = String(body.displayName ?? '').trim();
        const email = String(body.email ?? '')
            .trim()
            .toLowerCase();
        const teamIds: string[] = Array.isArray(body.teamIds)
            ? body.teamIds
            : [];

        if (!displayName) {
            return NextResponse.json(
                { error: 'Display name is required.' },
                { status: 400 },
            );
        }

        if (!email || !email.includes('@')) {
            return NextResponse.json(
                { error: 'Valid email required.' },
                { status: 400 },
            );
        }

        // 10 unique picks
        const unique = Array.from(
            new Set(teamIds.map(t => String(t).trim()).filter(Boolean)),
        );
        if (unique.length !== 10) {
            return NextResponse.json(
                { error: 'You must select exactly 10 different teams.' },
                { status: 400 },
            );
        }

        // Lock check
        const config = await readConfig();
        const lockAt = new Date(config.lock_at);
        if (Number.isNaN(lockAt.getTime())) {
            return NextResponse.json(
                { error: 'Invalid lock_at in Config sheet.' },
                { status: 500 },
            );
        }
        if (new Date() > lockAt) {
            return NextResponse.json(
                { error: 'Submissions are locked.' },
                { status: 403 },
            );
        }

        // Tier validation
        const poll = await readCoachesPoll(); // team_id -> rank
        const tierCounts: Record<string, number> = {
            TOP_1_5: 0,
            TOP_6_10: 0,
            TOP_11_15: 0,
            TOP_16_25: 0,
            UNRANKED: 0,
        };

        const picksWithTier = unique.map(team_id => {
            const rank = poll.get(team_id);
            const tier = tierForRank(rank);
            tierCounts[tier] += 1;
            return { team_id, tier };
        });

        const ok =
            tierCounts.TOP_1_5 === 2 &&
            tierCounts.TOP_6_10 === 2 &&
            tierCounts.TOP_11_15 === 2 &&
            tierCounts.TOP_16_25 === 2 &&
            tierCounts.UNRANKED === 2;

        if (!ok) {
            return NextResponse.json(
                { error: 'Invalid tier counts.', tierCounts },
                { status: 400 },
            );
        }

        // Write to Sheets
        const seasonYear = config.season_year ?? '2026';
        const entryId = makeEntryId(seasonYear);
        const nowIso = new Date().toISOString();

        const sheets = getSheets();

        // Append entry row
        await sheets.spreadsheets.values.append({
            spreadsheetId: SHEET_ID,
            range: 'Entries!A:E',
            valueInputOption: 'RAW',
            requestBody: {
                values: [[entryId, displayName, email, nowIso, 'FALSE']],
            },
        });

        // Append 10 pick rows in one batch
        await sheets.spreadsheets.values.append({
            spreadsheetId: SHEET_ID,
            range: 'Picks!A:E',
            valueInputOption: 'RAW',
            requestBody: {
                values: picksWithTier.map(p => [
                    entryId,
                    p.team_id,
                    p.tier,
                    nowIso,
                ]),
            },
        });

        console.log('Created entry:', entryId);

        return NextResponse.json({ entryId }, { status: 200 });
    } catch (e: any) {
        return NextResponse.json(
            { error: 'Server error.', detail: String(e?.message ?? e) },
            { status: 500 },
        );
    }
}
