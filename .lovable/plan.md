# Complete Baseline ATL

## What will be built
- Replace the starter screen with a polished Atlanta tennis home page using the existing photography, live league highlights, clear player and organizer paths, and the established green/lime sports identity.
- Add account creation and sign-in with persistent player profiles, including role, contact details, city, and NTRP level.
- Complete league registration from detail page through player details, payment-ready confirmation, capacity checks, and a clear success state.
- Add a player dashboard for registrations, season details, payment status, and profile editing.
- Add an organizer hub to create seasons and leagues, open or close registration, and inspect rosters.
- Complete all missing pages and navigation states, then verify key journeys on desktop and mobile.

## Data and access
- Use Lovable Cloud for accounts, profiles, seasons, leagues, and registrations.
- Keep public league discovery readable without signing in; require an account for registration and private dashboards.
- Store roles separately from profiles and enforce access rules so players only manage their own information while organizers can manage league operations.
- Seed the current Atlanta mock seasons, leagues, players, and registrations into the database so the first screen remains populated.

## Technical details
- Add database tables, constraints, grants, row-level access policies, and automatic profile creation on signup.
- Add protected TanStack routes for player and organizer surfaces, with server-side authorization on private operations.
- Validate every form in the browser and on the server with Zod.
- Preserve the existing public URLs and add unique metadata to every new page.
