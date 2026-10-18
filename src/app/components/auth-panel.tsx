"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Sprout } from "lucide-react";
import { loginAction, signupAction } from "@/app/actions/auth";
import { translate, type Locale } from "@/lib/i18n";

export function AuthPanel({ initialLocale }: { initialLocale: Locale }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [registering, setRegistering] = useState(false);
  const [loginState, loginFormAction, loginPending] = useActionState(
    loginAction,
    { message: "" },
  );
  const [signupState, signupFormAction, signupPending] = useActionState(
    signupAction,
    { message: "" },
  );
  const t = (key: string) => translate(locale, key);

  return (
    <main className="auth-page">
      <div className="auth-brand">
        <span className="brand-mark"><Sprout size={25} strokeWidth={2.2} /></span>
        <span>{t("appName")}</span>
      </div>
      <div className="auth-layout">
        <section className="auth-story">
          <div className="eyebrow"><span className="eyebrow-dot" /> Farm operations, made clear</div>
          <h1>Grow with a clearer view of your farm.</h1>
          <p>
            Keep crop cycles, field work, people and costs connected—from
            planting day through the last harvest.
          </p>
          <div className="auth-story-foot">
            <div className="story-avatar">S</div>
            <span>Made for the work that happens in the field.</span>
          </div>
          <div className="story-decoration story-decoration-one" />
          <div className="story-decoration story-decoration-two" />
        </section>

        <section className="auth-card">
          <div className="auth-locale">
            <label htmlFor="auth-language">{t("language")}</label>
            <select
              id="auth-language"
              onChange={(event) => setLocale(event.target.value as Locale)}
              value={locale}
            >
              <option value="en">English</option>
              <option value="sw">Kiswahili</option>
            </select>
          </div>
          <div className="auth-heading">
            <h2>{registering ? t("createAccount") : t("signIn")}</h2>
            <p>{registering ? t("setupRequired") : "Welcome back. Sign in to continue."}</p>
          </div>

          {registering ? (
            <form action={signupFormAction} className="auth-form">
              <label className="field">
                <span>{t("fullName")}</span>
                <input autoComplete="name" name="name" required minLength={2} />
              </label>
              <label className="field">
                <span>{t("email")}</span>
                <input autoComplete="email" name="email" type="email" required />
              </label>
              <label className="field">
                <span>{t("password")}</span>
                <input autoComplete="new-password" name="password" type="password" minLength={10} required />
                <small>Use at least 10 characters.</small>
              </label>
              <label className="field">
                <span>{t("farmName")}</span>
                <input name="farmName" autoComplete="organization" minLength={2} required />
              </label>
              <label className="field">
                <span>{t("region")}</span>
                <input name="region" autoComplete="address-level1" />
              </label>
              <input name="locale" type="hidden" value={locale} />
              <button className="button button-primary auth-submit" disabled={signupPending} type="submit">
                {signupPending ? "Creating…" : t("createWorkspace")}
                <ArrowRight size={17} />
              </button>
              <p aria-live="polite" className="form-message" role="status">{signupState.message}</p>
            </form>
          ) : (
            <form action={loginFormAction} className="auth-form">
              <label className="field">
                <span>{t("email")}</span>
                <input autoComplete="email" name="email" type="email" required />
              </label>
              <label className="field">
                <span>{t("password")}</span>
                <input autoComplete="current-password" name="password" type="password" required />
              </label>
              <button className="button button-primary auth-submit" disabled={loginPending} type="submit">
                {loginPending ? "Signing in…" : t("login")}
                <ArrowRight size={17} />
              </button>
              <p aria-live="polite" className="form-message" role="status">{loginState.message}</p>
            </form>
          )}

          <p className="auth-switch">
            {registering ? t("alreadyHaveAccount") : t("newHere")}{" "}
            <button onClick={() => setRegistering(!registering)} type="button">
              {registering ? t("signIn") : t("register")}
            </button>
          </p>
          <div className="auth-secure"><span className="secure-dot" /> {t("secureNote")}</div>
        </section>
      </div>
      <footer className="auth-footer">
        <span>© {new Date().getFullYear()} Shamba</span>
        <span>Built for better farm records</span>
      </footer>
    </main>
  );
}
