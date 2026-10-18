import "server-only";

import { createHash } from "node:crypto";
import { db } from "@/lib/db";

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getFarmInvitation(token: string) {
  return db.farmInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    select: {
      invitedEmail: true,
      expiresAt: true,
      acceptedAt: true,
      farm: { select: { name: true } },
    },
  });
}
