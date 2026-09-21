# Baseline Atlanta — Tuesday Technical Submission

## Executive position

The registration checkout is running on Stripe test mode in staging and has been verified end to end. It is not ready to accept real money until production authentication/authorization and unattended reservation cleanup are approved and verified.

## Precise architecture

```text
React UI (src/routes, src/components)
        │ fetch('/api/...')
        ▼
Vercel serverless function (api/index.ts)
        │ invokes
        ▼
Express 5 application (backend/src/server.ts)
        │ uses
        ├── reservation/payment services
        ├── Stripe API + signed webhook endpoint
        └── MongoDB Atlas: atlanta-tennis
```

React renders the browser UI and collects payment details through Stripe Elements. TanStack Router/Start supplies file-based routes, SSR/build integration, and Start middleware/CSRF plumbing. The payment and data APIs are Express routes deployed through Vercel serverless functions; they are not TanStack server functions. A repository search found no `createServerFn` usage. The earlier explanation described a possible TanStack architecture, not the implementation that was actually present.

The backend runs in Vercel Functions from `api/index.ts`, with Express mounted inside the function. MongoDB Atlas is the persistent database. Stripe is an external payment processor.

## Stripe webhook launch gate

`STRIPE_WEBHOOK_SECRET` is now required. The Stripe adapter calls `stripe.webhooks.constructEvent(rawBody, signature, secret)` and rejects missing or invalid signatures. The staging webhook is configured for `https://atlanta-tennis-staging.vercel.app/api/payments/webhook` and uses a Stripe test signing secret. Unsigned staging delivery returned HTTP 400. A signed duplicate event returned HTTP 200 and did not change the registration twice.

Production launch gate: configure a production `STRIPE_WEBHOOK_SECRET`, verify a signed event in production, and confirm that missing/invalid signatures return 400 before accepting real money.

## Evidence collected

| Requirement | Evidence | Result |
|---|---|---|
| Stripe sandbox checkout → registration | Browser checkout loaded Stripe Elements; declined test card showed “Your card has been declined”; `4242 4242 4242 4242` succeeded. Stripe PaymentIntent was `succeeded`, `capture_method=manual`, `amount_received=3500`, `livemode=false`; API record was `status=registered`, `amountCents=3500`. | Pass |
| Duplicate webhook | Same signed `payment_intent.succeeded` event was posted twice. Second delivery returned 200; reservation stayed registered and capacity was not decremented again. | Pass |
| Failed/cancelled payment | Declined card retained the reservation for retry. Explicit cancel returned 200, reservation status became `cancelled`, and the league spot returned. | Pass |
| Abandoned checkout | Automated test set `expiresAt` to 15 minutes ago. The expiry path cancelled the Stripe intent before releasing the slot; status became `expired`, capacity returned. | Pass |
| Concurrent capacity | Automated test ran 20 simultaneous registrations against one remaining slot. Exactly one succeeded; 19 were rejected; one reservation existed and spots remained zero. | Pass |
| Refresh recovery | Browser reload restored the same reservation and original countdown; no second reservation or PaymentIntent was created. | Pass |
| Navigation cancellation | Leaving checkout through “Back to League” triggered cancellation. API then reported `cancelled`; active reservations for the QA player were zero and league capacity returned to five. | Pass |

Automated evidence is in `backend/tests/reservations.test.cjs`. The final run passed 15/15 tests, including race, expiry, cancellation, amount mismatch, signed webhook, authorization capture, and post-deadline authorization cases.

## Expiry schedule and mechanism

Each reservation has a server-created `expiresAt` exactly 15 minutes after creation. The checkout timer requests cancellation at the deadline. League browsing and new reservations also run `expireReservations()` opportunistically. The deployed Vercel Hobby project has daily cron entries:

```text
00:00 UTC  /api/cron/expire
01:00 UTC  /api/cron/reconcile
```

Both endpoints require `Authorization: Bearer <CRON_SECRET>`. Vercel Hobby cannot run a minute-level cron; Vercel documents daily-only Hobby scheduling. Therefore unattended cleanup during periods with no traffic is a launch limitation. Use Vercel Pro or an external scheduler for `/api/cron/expire` every minute and `/api/cron/reconcile` every five minutes before production launch.

## Authentication and authorization

This is currently a prototype gap and a launch blocker. Login is demo/local-storage based, and registration/payment lookups accept an email or reservation ID supplied by the caller. The admin registration endpoint checks `x-admin-key`, but there is no authenticated session/JWT middleware enforcing that the caller owns a player record or is an organizer. A player could therefore attempt to query another email or reservation ID if they know it. Do not claim production access control until server-side identity, ownership checks, and organizer role authorization are implemented and tested.

## Data provenance

The 504 players, 120 tournament histories, and 69 reservations are test data: generated by the seed script and created during manual application testing. They are not identified as real customers, and no real-user consent basis is claimed. The seed script documents 500 generated players and 120 generated histories; later QA activity accounts for the larger player/reservation counts. Remove or replace this data with approved production data before launch.

## Plain-English launch decision

Stripe checkout and capacity handling are verified in staging. Real-money launch remains blocked by three gates: production webhook secret verification, production authentication/ownership/organizer authorization, and a reliable unattended expiry scheduler. The evidence above supports the implemented payment and reservation behavior without claiming those remaining controls exist.
