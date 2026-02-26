import { getSheets, SHEET_ID } from './sheets';

type ConfigMap = Record<string, string>;

export async function readConfig(): Promise<ConfigMap> {
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'Config!A:B',
    });

    const rows = res.data.values ?? [];
    const map: ConfigMap = {};
    for (const [k, v] of rows) {
        if (k) map[String(k).trim()] = String(v ?? '').trim();
    }
    return map;
}

export async function readCoachesPoll(): Promise<Map<string, number>> {
    // returns team_id -> rank (1-25)
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'CoachesPoll!A:C',
    });

    const rows = res.data.values ?? [];
    const map = new Map<string, number>();

    // Expect header row. If you don't use headers, remove the slice(1).
    for (const row of rows.slice(1)) {
        const rank = Number(row[0]);
        const teamId = String(row[1] ?? '').trim();
        if (teamId && Number.isFinite(rank)) map.set(teamId, rank);
    }
    return map;
}

export type TeamResult = {
    team_id: string;
    wins: number;
    max_round: string;
    is_champion: boolean;
};

export async function readResults(): Promise<Map<string, TeamResult>> {
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'Results!A:D',
    });

    const rows = res.data.values ?? [];
    const map = new Map<string, TeamResult>();

    for (const row of rows.slice(1)) {
        const team_id = String(row[0] ?? '').trim();
        if (!team_id) continue;
        const wins = Number(row[1] ?? 0);
        const max_round = String(row[2] ?? '').trim();
        const is_champion = String(row[3] ?? '').toLowerCase() === 'true';
        map.set(team_id, { team_id, wins, max_round, is_champion });
    }
    return map;
}

export function tierForRank(rank?: number) {
    if (!rank) return 'UNRANKED';
    if (rank >= 1 && rank <= 5) return 'TOP_1_5';
    if (rank <= 10) return 'TOP_6_10';
    if (rank <= 15) return 'TOP_11_15';
    return 'TOP_16_25'; // 16–25
}
