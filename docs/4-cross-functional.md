# Cross-Functional Notes

## Questions for Ibrahim (Frontend Data Requirements)
- Do we have a finalized schema for the exact fields required during the mock payment flow, or should we keep it generic?
- Are there specific validation rules for player data (e.g., minimum age, specific phone number formats) that need to be enforced on the frontend?
- How should the frontend handle empty states for future features like match results or leaderboards?

## Questions for Haroon (Backend/Performance Dependencies)
- Once the prototype moves to a real backend, will we need to implement optimistic UI updates for interactions like registration?
- What are the anticipated payload sizes for fetching league data, and should we implement virtualization for long lists?
- Will the real authentication system require specific frontend workflows (e.g., OTP, OAuth redirects) that we should anticipate in our mock UI?
