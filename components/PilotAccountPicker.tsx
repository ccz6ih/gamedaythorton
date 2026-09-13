/**
 * components/PilotAccountPicker.tsx
 * Fills the sign-in form with one of the seeded pilot accounts.
 *
 * Exists because a demo that requires typing an invented email address on a
 * clinic iPad is a demo that stalls in the first thirty seconds. It renders only
 * while PILOT_MODE is on, and it fills the email only — the password still comes
 * from whoever is running the demo.
 */

'use client';

type Account = { email: string; who: string; what: string };

export function PilotAccountPicker({ accounts }: { accounts: Account[] }) {
  function fill(email: string) {
    const field = document.getElementById('email') as HTMLInputElement | null;
    if (field) {
      field.value = email;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const password = document.getElementById('password') as HTMLInputElement | null;
    password?.focus();
  }

  return (
    <div className="cred-list">
      <div className="lbl">Pilot accounts — tap to fill the email</div>
      {accounts.map(a => (
        <button key={a.email} type="button" onClick={() => fill(a.email)}>
          <span>
            <span className="who">{a.who}</span>
            <br />
            <span className="what">{a.what}</span>
          </span>
          <span className="mono what">{a.email}</span>
        </button>
      ))}
    </div>
  );
}
