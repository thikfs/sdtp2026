// Staff sign-in screen. Shown before the app loads any data when the backend needs sign-in.
import { ApiError, type Auth, type SchedulingApi } from './api';

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function message(err: unknown): string {
  if (err instanceof ApiError && err.status === 403) return 'This account is not set up as clinic staff. Ask the dentist to add you.';
  if (err instanceof ApiError && (err.status === 400 || /invalid login/i.test(err.message))) return 'Wrong email or password.';
  if (!navigator.onLine || (err instanceof ApiError && err.status === 0)) return 'You seem to be offline. Check your connection and try again.';
  return 'Could not sign in. Please try again.';
}

/** Resolves once a signed-in user is confirmed to be active staff. */
export async function signInGate(auth: Auth, api: SchedulingApi): Promise<void> {
  if (await auth.hasSession()) {
    try {
      await api.me();
      return;
    } catch (err) {
      // Not staff, or the session is no longer valid: sign in again. Other errors (offline) let the app
      // open with the existing session; it shows its own connection errors.
      if (!(err instanceof ApiError && (err.status === 401 || err.status === 403))) return;
      await auth.signOut();
    }
  }

  const screen = el<HTMLDivElement>('signin'), form = el<HTMLFormElement>('signin-form');
  const email = el<HTMLInputElement>('si-email'), pw = el<HTMLInputElement>('si-pw');
  const err = el<HTMLParagraphElement>('si-err'), btn = el<HTMLButtonElement>('si-go');
  screen.hidden = false;
  email.focus();

  return new Promise((done) => {
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (btn.disabled) return;
      err.hidden = true;
      btn.disabled = true;
      btn.textContent = 'Signing in…';
      try {
        await auth.signIn(email.value.trim(), pw.value);
        try {
          await api.me();
        } catch (e) {
          await auth.signOut();
          throw e;
        }
        pw.value = '';
        screen.hidden = true;
        done();
      } catch (e) {
        err.textContent = message(e);
        err.hidden = false;
        pw.select();
      } finally {
        btn.disabled = false;
        btn.textContent = 'Sign in';
      }
    };
  });
}
