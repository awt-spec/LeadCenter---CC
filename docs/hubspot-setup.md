# HubSpot integration — setup

How to wire LeadCenter ↔ HubSpot via OAuth so the `/settings/integrations` page
can sync Companies → Accounts, Contacts → Contacts, Deals → Opportunities.

## 1. Create a HubSpot Public App

1. Go to <https://developers.hubspot.com/> and sign in with the SYSDE
   developer account.
2. **Apps → Create app** (Public App).
3. **Basic info**: name "LeadCenter SYSDE", description "Internal CRM sync".
4. **Auth tab**:
   - **Redirect URLs** — add **both**:
     - `http://localhost:3000/api/integrations/hubspot/callback` (dev)
     - `https://lead-center-cc.vercel.app/api/integrations/hubspot/callback` (prod)
   - **Scopes** — required (read-only first):
     - `crm.objects.contacts.read`
     - `crm.objects.companies.read`
     - `crm.objects.deals.read`
     - `crm.schemas.contacts.read`
     - `crm.schemas.companies.read`
     - `crm.schemas.deals.read`
     - `crm.objects.owners.read`
     - `oauth`
5. Save → copy **Client ID** and **Client secret**.

## 2. Set environment variables

In Vercel (`Project → Settings → Environment Variables`) and your local
`.env.local`:

```
HUBSPOT_CLIENT_ID=<client id>
HUBSPOT_CLIENT_SECRET=<client secret>
# Optional override (only if you want a different callback URL than AUTH_URL):
HUBSPOT_REDIRECT_URI=https://lead-center-cc.vercel.app/api/integrations/hubspot/callback
```

Re-deploy so the env vars are picked up.

## 3. Connect from the app

1. Sign in as an admin (`settings:update` permission).
2. Sidebar → **Integraciones** (or `/settings/integrations`).
3. Click **Conectar HubSpot**.
4. Authorize the app on HubSpot.
5. You're redirected back; status badge turns to **Conectado**.

## 4. Run the first sync

Click **Sincronizar ahora**. The sync runs in this order:

1. **Companies → Accounts** (matched by domain, or new with `hs-<id>.hubspot.lc-imported` placeholder).
2. **Contacts → Contacts** (matched by email).
3. **Deals → Opportunities** (linked to the previously-synced Account).

Each external record gets a row in `IntegrationMapping` so re-syncs are
idempotent — same HubSpot id → same LeadCenter id.

## 5. Tokens & security

- Access + refresh tokens are stored AES-256-GCM encrypted at rest using a key
  derived from `AUTH_SECRET` via `scrypt`.
- Tokens auto-refresh ~60s before they expire.
- Disconnect clears the tokens but **keeps the mappings** so re-connecting
  doesn't duplicate data.

## 6. Roadmap (next iterations)

- Webhook subscriptions for incremental sync (HubSpot → LC near-real-time).
- Cron job for delta pulls (every 15min via Vercel Cron).
- Bidirectional: requires re-auth with `crm.objects.*.write` scopes.
- Mapping editor UI to customize property → field mapping per tenant.
- Activities sync (Notes / Calls / Emails / Tasks → LeadCenter Activity).
