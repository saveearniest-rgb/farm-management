"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Sprout } from "lucide-react";
import { loginAction, signupAction } from "@/app/actions/auth";
import { translate, type Locale } from "@/lib/i18n";

export function AuthPanel({
  initialLocale,
  redirectTo = "/",
}: {
  initialLocale: Locale;
  redirectTo?: string;
}) {
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
          <div className="eyebrow"><span className="eyebrow-dot" /> {t("authStoryEyebrow")}</div>
          <h1>{t("authHeadline")}</h1>
          <p>{t("authDescription")}</p>
          <div className="auth-story-foot">
            <div className="story-avatar">S</div>
            <span>{t("authStoryFoot")}</span>
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
              <option value="en">{t("english")}</option>
              <option value="sw">{t("kiswahili")}</option>
            </select>
          </div>
          <div className="auth-heading">
            <h2>{registering ? t("createAccount") : t("signIn")}</h2>
            <p>{registering ? t("setupRequired") : t("welcomeBack")}</p>
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
                <small>{t("passwordHint")}</small>
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
              <input name="redirectTo" type="hidden" value={redirectTo} />
              <button className="button button-primary auth-submit" disabled={signupPending} type="submit">
                {signupPending ? t("creating") : t("createWorkspace")}
                <ArrowRight size={17} />
              </button>
              <p aria-live="polite" className="form-message" role="status">{signupState.message}</p>
            </form>
          ) : (
            <form action={loginFormAction} className="auth-form">
              <input name="redirectTo" type="hidden" value={redirectTo} />
              <label className="field">
                <span>{t("email")}</span>
                <input autoComplete="email" name="email" type="email" required />
              </label>
              <label className="field">
                <span>{t("password")}</span>
                <input autoComplete="current-password" name="password" type="password" required />
              </label>
              <button className="button button-primary auth-submit" disabled={loginPending} type="submit">
                {loginPending ? t("signingIn") : t("login")}
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
        <span>{t("authFooter")}</span>
      </footer>
    </main>
  );
}
