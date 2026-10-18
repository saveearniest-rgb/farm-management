"use client";

import { useActionState, useRef } from "react";
import { changeLocaleAction } from "@/app/actions/auth";
import type { Locale } from "@/lib/i18n";

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const [state, action, pending] = useActionState(changeLocaleAction, { message: "" });
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="language-control">
      <span>{locale === "sw" ? "Lugha" : "Language"}</span>
      <form action={action} ref={formRef}>
        <select
          aria-label={locale === "sw" ? "Lugha" : "Language"}
          defaultValue={locale}
          name="locale"
          onChange={() => formRef.current?.requestSubmit()}
        >
          <option value="en">EN</option>
          <option value="sw">SW</option>
        </select>
      </form>
      <span aria-live="polite" className="sr-only" role="status">
        {pending ? (locale === "sw" ? "Inahifadhi lugha..." : "Saving language...") : state.message}
      </span>
    </div>
  );
}
