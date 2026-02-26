import { NextResponse } from 'next/server';
import { getSheets, SHEET_ID } from '@/lib/sheets';

export const runtime = 'nodejs';

export async function GET() {
    const sheets = getSheets();

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: 'A1:A1',
    });

    return NextResponse.json({ success: true, data: res.data });
}
