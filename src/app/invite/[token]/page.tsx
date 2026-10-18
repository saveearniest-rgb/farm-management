import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthPanel } from "@/app/components/auth-panel";
import { ActionForm } from "@/app/components/action-form";
import { acceptFarmInviteAction } from "@/app/actions/settings";
import { getAppContext } from "@/lib/auth";
import { translate, type Locale } from "@/lib/i18n";
import { getFarmInvitation } from "@/lib/invitations";

export default function FarmInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<main className="auth-page"><div className="app-loading">Loading invitation…</div></main>}>
      <FarmInviteContent params={params} />
    </Suspense>
  );
}

async function FarmInviteContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{32,80}$/.test(token)) redirect("/");

  const [context, invitation] = await Promise.all([
    getAppContext(),
    getFarmInvitation(token),
  ]);
  const locale: Locale = context?.user.locale === "sw" ? "sw" : "en";
  const t = (key: string) => translate(locale, key);
  if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date()) {
    return <main className="auth-page"><section className="auth-card"><h1>{t("inviteUnavailable")}</h1><p>{t("inviteExpired")}</p></section></main>;
  }
  if (!context) {
    return <AuthPanel initialLocale="en" redirectTo={`/invite/${token}`} />;
  }

  const emailMatches = context.user.email.toLowerCase() === invitation.invitedEmail;
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="eyebrow">{t("inviteEyebrow")}</div>
        <h1>{invitation.farm.name}</h1>
        {emailMatches ? (
          <>
            <p>{t("inviteDescription")}</p>
            <ActionForm action={acceptFarmInviteAction} submitLabel={t("acceptInvite")}>
              <input name="token" type="hidden" value={token} />
            </ActionForm>
          </>
        ) : (
          <p>{t("inviteWrongAccount").replace("{email}", invitation.invitedEmail)}</p>
        )}
      </section>
    </main>
  );
}
