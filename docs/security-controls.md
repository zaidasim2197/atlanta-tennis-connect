# Security controls and verification

## Requirement in the execution brief

The Haroon Execution Brief requires these controls. Page 3, workstream 6, calls for visitor/player/organiser access control, password/auth-token handling, admin controls, personal data protection, payment-token handling, auditability and backups. Its Authorisation test requires another player's private profile/registration and a non-admin's admin action to be rejected by the server. Pages 2 and 4 require evidence and an explicit register of remaining launch requirements.

## Implemented controls

- Signup and login use server-side accounts. Passwords are salted and hashed with scrypt (N=131072, r=8, p=1); they are never persisted in browser storage. Existing prototype credential caches are removed on app startup.
- An opaque random session is stored in an HttpOnly, Secure, SameSite=Lax cookie in production. Only its SHA-256 hash is stored in MongoDB. Logout revokes the session. Every request checks expiry, account status and the current role, independently of TTL cleanup.
- Player reads and writes require a session and ownership. Organisers may read profiles for administration; profile writes remain self-only. An anonymous upsert cannot create or overwrite a player.
- Registration creation uses the signed-in account's email. Cross-player requests are forbidden; registration listings require ownership or an organiser role.
- Payment status, checkout resume, reconciliation and both cancellation aliases check the reservation's player ID or an organiser role before touching Stripe or returning data. Checkout resume is POST because it can reconcile payment state.
- The admin registration route requires an authenticated organiser. `ADMIN_KEY`, user-supplied role values and localStorage cannot grant that role.
- Exact browser origins are configured through CLIENT_URL and ALLOWED_ORIGINS. Arbitrary domains, unrelated Vercel apps and production localhost origins are rejected. Cookie-authenticated writes require an approved Origin. Stripe's signed webhook remains independent of browser sessions.
- Private responses use Cache-Control: no-store. Authentication attempts are rate-limited with MongoDB counters shared by serverless instances. Middleware errors do not return stacks or database details.

## Verification

Run `npm --prefix backend test`. The suite contains 13 HTTP security tests and 15 reservation/payment tests using isolated MongoDB replica sets. Security tests exercise anonymous and cross-player access, mutation attempts, all payment aliases, organiser permissions, forged/expired/revoked sessions, secure cookie flags, password storage, CORS, CSRF and persistent login throttling. The reservation tests continue to exercise race safety, cancellation, expiry, idempotency and payment verification with a fake provider.

Frontend and API type checks: `npx tsc --noEmit` and `npx tsc --noEmit -p api/tsconfig.json`. Production build: `npm run build`.

The controlled real Stripe runner creates distinct authenticated QA accounts before timing its race. Bulk k6 scripts require AUTH_SESSIONS_FILE, a local JSON map of seeded email to session cookie, and CLIENT_ORIGIN matching the configured frontend origin. Do not commit that file. Do not disable authentication to run load tests. Historical unauthenticated load results do not establish current authenticated throughput.

## Account operations

New signups always receive the player role. An operator can promote an existing account after verifying the person's identity and entitlement:

```
npm --prefix backend run build
node backend/scripts/set-account-role.cjs organiser@example.com organizer
```

The command uses the operator's database access and revokes that account's existing sessions. Use `player` to revoke the organiser role. No organiser or default password is provisioned automatically. Seeded/manual profiles cannot be claimed through signup by merely knowing an email. Do not import browser-stored prototype passwords. Those profiles need an identity-verified account migration before use by real players. Email verification, automated password recovery and MFA are not implemented by this change.

## Backup requirement remains open

Database credentials cannot establish Atlas organisation permissions or prove that backups exist. Atlas console access was unavailable during this work, so no tier change, snapshot configuration or restore is claimed.

The Atlas project owner must:

1. Confirm the production cluster and its backup policy. If it is M0, select a backup-capable tier or an approved scheduled backup system; do not upgrade a paid resource without approving its cost.
2. Verify successful snapshots and retention. Atlas Flex provides daily snapshots and retains the last eight; its first snapshot is not immediate.
3. Restore a snapshot to a separate test cluster/database. Do not overwrite the live database. Verify representative players, leagues, reservations, payment references and audit records; record restoration time and latest recoverable timestamp.
4. Restrict backup access, document the owner and alerting for failed backups, and retain the snapshot ID and restore evidence in the launch record.

Backups remain an open launch requirement until that evidence exists. Code fixes and successful authentication tests do not close it.

References: [Atlas Flex backups](https://www.mongodb.com/docs/atlas/backup/cloud-backup/flex-cluster-backup/), [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
