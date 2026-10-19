# Operations

## Runtime and hosting

The application requires Node.js 20.9 or newer and PostgreSQL 14 or newer. For development, use the included Compose PostgreSQL service. For a hosted deployment, use a managed PostgreSQL service and a supported Node.js host that can run the Next.js server.

V1 attachments are stored on local disk, outside `public/`, and encrypted with AES-256-GCM. The file key is derived from `AUTH_SECRET`; preserve the same secret when restoring a backup or files cannot be decrypted. Configure `LOCAL_FILE_STORAGE_PATH` to a persistent, access-restricted volume. A deployment with ephemeral local storage is not suitable for farm attachments. S3-compatible storage is not implemented yet.

## Environment

Set these values in the deployment's secret/configuration manager:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma |
| `AUTH_SECRET` | Auth.js signing secret and key material for encrypted attachments; generate a random value of at least 32 bytes |
| `APP_URL` | Public application origin used for authentication and invitation links |
| `LOCAL_FILE_STORAGE_PATH` | Optional persistent directory for encrypted private files |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT` | Local Compose database settings; not required when using an external database |

Do not reuse the example local database password in a hosted environment. Do not rotate `AUTH_SECRET` without first planning to re-encrypt existing attachments; changing it invalidates sessions and makes existing encrypted files unreadable.

## Database migrations

Apply checked-in migrations during deployment:

```powershell
npx.cmd prisma migrate deploy
```

Generate the Prisma client as part of the build:

```powershell
npm.cmd run db:generate
```

Do not point integration tests or local development at production data.

## Backups and restore

Back up PostgreSQL and the encrypted attachment directory together. Use the provider's encrypted snapshots or a protected `pg_dump` backup, and store backups separately from the application host. Keep `AUTH_SECRET` in the same protected recovery system. Test restoring both the database and attachment volume before relying on the backups.

For a local Compose database, a logical backup can be made with:

```powershell
docker compose exec -T postgres pg_dump -U shamba farm_management > farm-management.sql
```

Restore only into an explicitly selected, empty recovery database:

```powershell
docker compose exec -T postgres createdb -U shamba farm_management_recovery
Get-Content farm-management.sql | docker compose exec -T postgres psql -U shamba -d farm_management_recovery
```

The local Compose credentials are development-only. Configure scheduled backups, encryption, access controls, monitoring, and a documented recovery objective before storing production farm data.

## Privacy, deletion, and retention

- Farm exports are available to farm owners as JSON or CSV after an export request is recorded. The CSV contains a table name and a JSON record per row; attachments are represented by metadata, not file contents.
- A deletion request is recorded for review and is not an automatic deletion command. Verify the requester and scope, check for legal holds or obligations, then document the decision and completion before deleting account or farm data.
- Audit records contain the actor, action, entity, record identifier, and time; they do not contain record field values. Keep them with the farm workspace while it is active. On approved workspace deletion, remove them with the workspace unless a legal hold or applicable retention obligation requires otherwise.
- Before production use, have a Tanzanian privacy/legal professional set any statutory retention periods and review the deletion workflow. The application does not currently perform automatic retention purges or farm/person deletion.
- Avoid uploading national identity copies or other highly sensitive documents until the access and deletion workflow has been reviewed for the farm's legal requirements.

## Operational limits

- Offline queueing covers supported text/form records only. File uploads require a connection; pending entries remain in the browser until synced and are scoped to the selected farm.
- Attachments are encrypted at rest on the configured local volume, but storage redundancy and backups are the operator's responsibility.
- The V1 economics report supports CSV, browser print-to-PDF, and a formula-driven Excel workbook. Excel exports include assumptions with source labels, cycle-month cash flow with an editable harvest-share curve, and an income summary. Excel-compatible software recalculates the live formulas when inputs change.
- Harvest, packaging and transport plan lines are rates per yield unit. All other planned cost lines are total costs; duplicate lines can split costs across cycle months. Saving an expected plan initializes editable low-price (30% below expected) and low-yield (40% below expected) scenarios if they do not already exist.
- Investment agreements, payment processing, SMS/WhatsApp, weather feeds, e-signatures, and subscription billing are not enabled.
