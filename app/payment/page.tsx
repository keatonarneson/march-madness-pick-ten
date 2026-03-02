// app/payment/page.tsx
import Link from 'next/link';
import { readConfig } from '@/lib/poolData'; // adjust path if needed

export const metadata = {
    title: 'How to Pay | March Madness Pick 10',
};

export default async function PaymentPage() {
    const config = await readConfig();

    const entryFee = Number(config?.entry_fee ?? 20);

    const VENMO_HANDLE = String(config?.venmo_handle ?? '').trim();
    const PAYPAL_CONTACT = String(config?.paypal_contact ?? '').trim();
    const EMAIL = String(config?.commissioner_email ?? '').trim();

    return (
        <main style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px' }}>
            <h1 style={{ fontSize: 28, margin: '0 0 12px' }}>How to Pay</h1>

            <p style={{ margin: '0 0 18px', lineHeight: 1.6 }}>
                This pool does not take payments on the website. Use one of the
                options below to pay your entry fee. Once you’ve paid, your
                entry will be marked as <strong>Paid</strong> on the
                leaderboard.
            </p>

            <section style={card}>
                <h2 style={h2}>Entry Fee</h2>
                <ul style={ul}>
                    <li>
                        Entry fee: <strong>${entryFee}</strong>
                    </li>
                </ul>
                <p style={p}>
                    Include your <strong>display name</strong> (and if possible
                    your <strong>entry ID</strong>) in the payment note so we
                    can match it quickly.
                </p>
            </section>

            <section style={card}>
                <h2 style={h2}>Pay via Venmo</h2>
                <p style={p}>
                    Send <strong>${entryFee}</strong> to{' '}
                    <strong>{VENMO_HANDLE}</strong>.
                    <br />
                    Note: “March Madness Pick 10 – <em>Your Display Name</em>”
                </p>
            </section>

            <section style={card}>
                <h2 style={h2}>Pay via PayPal</h2>
                <p style={p}>
                    Send <strong>${entryFee}</strong> to{' '}
                    <strong>{PAYPAL_CONTACT}</strong>.
                    <br />
                    Note: “March Madness Pick 10 – <em>Your Display Name</em>”
                </p>
            </section>

            <section style={card}>
                <h2 style={h2}>Other Options</h2>
                <p style={p}>
                    If you want to pay another way (cash, Zelle, etc.), message
                    the commissioner.
                </p>
            </section>

            <section style={card}>
                <h2 style={h2}>When will I show as Paid?</h2>
                <p style={p}>
                    As soon as we match your payment to your entry, we’ll mark
                    it paid and it will show on the leaderboard.
                </p>
            </section>

            <section style={{ ...card, marginBottom: 0 }}>
                <h2 style={h2}>Commissioner</h2>
                <p style={p}>
                    <a
                        href={`mailto:${EMAIL}`}
                        style={{ textDecoration: 'underline' }}
                    >
                        {EMAIL}
                    </a>
                </p>
            </section>

            <div style={{ marginTop: 18 }}>
                <Link href="/" style={{ textDecoration: 'underline' }}>
                    ← Back to home
                </Link>
            </div>
        </main>
    );
}

const card = {
    border: '1px solid #ddd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
};

const h2 = { fontSize: 18, margin: '0 0 8px' };
const ul = { margin: 0, paddingLeft: 18, lineHeight: 1.7 };
const p = { margin: 0, lineHeight: 1.6 };
