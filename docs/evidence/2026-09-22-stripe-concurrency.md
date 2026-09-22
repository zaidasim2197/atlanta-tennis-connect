# Real Stripe concurrency evidence — 22 September 2026

Environment: `https://atlanta-tennis-staging.vercel.app`  
Payment provider: Stripe test mode (`livemode=false`)  
League: `l-hot` / Peachtree Last-Spots Singles  
Available places before test: 3  
Concurrent registration requests: 12

## Result

- HTTP 201: 3
- HTTP 409: 9
- Unexpected responses: 0
- Available places after race: 0
- Real Stripe PaymentIntents created: 3
- Distinct Stripe PaymentIntent IDs: 3
- Stripe creation/call failures observed: 0
- Recovery-path responses observed: 0
- Available places after cleanup: 3
- PaymentIntents cancelled during cleanup: 3 of 3

## Per-request evidence

| Request | HTTP |  Duration | Reservation                | Stripe PaymentIntent          |
| ------: | ---: | --------: | -------------------------- | ----------------------------- |
|      01 |  201 |  8,977 ms | `6ab216ef39e0858942e2aa2c` | `pi_3UIMaC3LwR6lzVYP1Vih7e5o` |
|      02 |  201 | 11,152 ms | `6ab216f22b61c35c552f6da7` | `pi_3UIMaE3LwR6lzVYP0WwmZYrT` |
|      03 |  409 | 10,910 ms | —                          | —                             |
|      04 |  409 | 11,106 ms | —                          | —                             |
|      05 |  409 | 11,159 ms | —                          | —                             |
|      06 |  409 | 10,846 ms | —                          | —                             |
|      07 |  409 | 11,100 ms | —                          | —                             |
|      08 |  201 |  9,940 ms | `6ab216f076026437223abb07` | `pi_3UIMaD3LwR6lzVYP1b10gfxZ` |
|      09 |  409 | 11,057 ms | —                          | —                             |
|      10 |  409 | 11,074 ms | —                          | —                             |
|      11 |  409 | 11,054 ms | —                          | —                             |
|      12 |  409 | 11,032 ms | —                          | —                             |

All nine 409 responses contained `League is full or registration is closed`.

## Stripe API retrieval evidence

| PaymentIntent                 | Status after creation     |    Amount | Mode | Metadata reservation ID    |
| ----------------------------- | ------------------------- | --------: | ---- | -------------------------- |
| `pi_3UIMaC3LwR6lzVYP1Vih7e5o` | `requires_payment_method` | USD 40.00 | test | `6ab216ef39e0858942e2aa2c` |
| `pi_3UIMaE3LwR6lzVYP0WwmZYrT` | `requires_payment_method` | USD 40.00 | test | `6ab216f22b61c35c552f6da7` |
| `pi_3UIMaD3LwR6lzVYP1b10gfxZ` | `requires_payment_method` | USD 40.00 | test | `6ab216f076026437223abb07` |

Each intent was retrieved directly from Stripe's API. Each had `leagueSlug=l-hot`, a distinct ID, and metadata matching exactly one winning reservation. Because all three successful API responses contained an intent, all three intents were retrievable, and there were no non-201/non-409 responses, this run observed no failed `ensurePayment` call or unexpected recovery-path response.

## Cleanup evidence

The three application cancellation calls returned HTTP 200 with `released=true`. Direct Stripe retrieval then reported all three intents as `canceled`. The league returned from zero to three available places.

## Reproduction

Run `npm --prefix backend run test:stripe-concurrency`. The runner refuses to run unless the local credential begins with `sk_test_`, refuses to send requests unless `l-hot` has exactly three available places, retrieves every winning intent directly from Stripe, checks all assertions, and restores the test capacity.
