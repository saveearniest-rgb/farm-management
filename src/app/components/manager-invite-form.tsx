"use client";

import { useActionState, useState } from "react";
import { createManagerInviteAction } from "@/app/actions/settings";
import type { Locale } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import type { FormState } from "@/lib/form-state";

const initialState: FormState = { message: "" };

export function ManagerInviteForm({ locale }: { locale: Locale }) {
  const [state, action, pending] = useActionState(
    createManagerInviteAction,
    initialState,
  );
  const [copyMessage, setCopyMessage] = useState("");
  const t = (key: string) => translate(locale, key);

  async function copyInviteLink() {
    if (!state.invitationUrl) return;
    try {
      await navigator.clipboard.writeText(state.invitationUrl);
      setCopyMessage(t("inviteLinkCopied"));
    } catch (error) {
      setCopyMessage(error instanceof Error ? error.message : t("inviteLinkCopyFailed"));
    }
  }

  return (
    <form action={action} className="record-form form-grid">
      <label className="field">
        <span>{t("managerEmail")}</span>
        <input autoComplete="email" name="email" required type="email" />
      </label>
      <div className="form-footer">
        <button className="button button-primary" disabled={pending} type="submit">
          {pending ? t("creatingInvite") : t("createInvite")}
        </button>
        <p aria-live="polite" className={`form-message ${state.success ? "is-success" : ""}`} role="status">
          {state.message}
        </p>
      </div>
      {state.invitationUrl && (
        <div className="field-wide invite-link-result">
          <label className="field">
            <span>{t("inviteLink")}</span>
            <input readOnly value={state.invitationUrl} />
          </label>
          <button className="button button-quiet" onClick={copyInviteLink} type="button">
            {t("copyInviteLink")}
          </button>
          <p aria-live="polite" className="form-message" role="status">{copyMessage}</p>
        </div>
      )}
    </form>
  );
}
