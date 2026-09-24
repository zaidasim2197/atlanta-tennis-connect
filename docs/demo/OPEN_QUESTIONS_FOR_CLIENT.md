# Baseline ATL — Open Operational Questions for Client

> **Notice:** The operational demo built for Baseline ATL purposefully simulates data structures without presuming business decisions on features that require organizer policy. The following questions are catalogued as open client decisions.

---

### 1. Match Scheduling & Time Windows
* **Question:** Who is responsible for selecting the specific match day and start time?
* **Options:**
  1. Fixed weekly league time slot assigned by the league (e.g. Tuesdays at 6:30 PM).
  2. Flexible window where players are given a 7-day window to mutually schedule their match.
* **Current Demo Status:** *Not decided / Simulated fixture assignments only.*

---

### 2. Court Booking & Facility Access
* **Question:** Who books and pays for the court?
* **Options:**
  1. The nominal "Home" player books their designated home/preferred court.
  2. The organizer reserves blocks of public/partner courts in advance.
  3. Players mutually agree on any convenient public court.
* **Current Demo Status:** *Not implemented. The platform does not integrate with court reservation systems.*

---

### 3. Players Without a Home Court
* **Question:** What happens when a player registers without a designated home court (~8% of players)?
* **Current Demo Status:** *Shows "Court TBC". Operational fallback rules (e.g. auto-assigning opponent's court or central park courts) are not yet established.*

---

### 4. Rescheduling and Weather Policy
* **Question:** In the event of rain or player conflict, what is the rescheduling deadline?
* **Options:**
  1. Matches must be made up within 14 days.
  2. Organizer intervention required for any match reschedule.
* **Current Demo Status:** *Not implemented. `reschedule_requested` is an illustrative status label with no automated workflow.*

---

### 5. Forfeits, Defaults, and No-Shows
* **Question:** How are no-shows scored and penalized in standings?
* **Current Demo Status:** *Not decided. Current standings calculate standard match wins and game differentials.*

---

### 6. Division Balancing & Skill Verification
* **Question:** Are players allowed to self-rate via NTRP, or is verification required before placement into divisions?
* **Current Demo Status:** *Self-rated on signup. Admin review workflows and automatic division tier re-balancing are not implemented.*

---

### 7. Late Registrations & Waitlists
* **Question:** How are late applicants handled once a league division hits maximum capacity?
* **Current Demo Status:** *Leagues close when `spotsRemaining === 0`. Automated waitlist queues and back-fill logic are not implemented.*

---

### 8. Playoff Qualification & Tie-Breakers
* **Question:** What exact criteria qualify players for the post-season playoff bracket?
* **Options:**
  1. Top 2 per division.
  2. Wildcard based on game differential.
  3. Head-to-head records.
* **Current Demo Status:** *Not implemented. The playoff bracket screen is a visual demonstration only.*

---

### 9. Doubles Partner Matching & Replacement
* **Question:** If a player enters a doubles league without a partner, how are they paired? What happens if a partner drops out mid-season?
* **Current Demo Status:** *The registration model supports mutual `partnerSlug` references, but automated partner discovery/matching algorithms and mid-season substitution workflows are not built.*

---

### 10. Junior Age Bands & Minimum Age Policy
* **Question:** What is the exact allowed age band for junior leagues (e.g. 13–17 vs under-13)? Are players under 13 permitted with parental consent?
* **Current Demo Status:** *The platform currently allows any date of birth under 18 with parent name and phone. The demo dataset assumes ages 13–17; under-13 registration policy is not yet decided.*

---

### 11. Safeguarding & Junior Supervision
* **Question:** Does Baseline ATL require in-person coach/court supervision, background checks, or parent presence for junior matches?
* **Current Demo Status:** *Not implemented. Junior fixtures are scheduled daytime/early evening, but physical supervision workflows are not part of the platform.*

---

### 12. Age-Eligibility & Gender-Eligibility Enforcement
* **Question:** How should the platform enforce format eligibility (e.g. adult trying to join junior league, or player selecting format outside their gender identity)?
* **Current Demo Status:** *Not enforced at the API level. Fields are collected for profile display and manual organizer review only.*

---

### 13. Non-Binary and Undisclosed Gender Participation
* **Question:** What format participation rules apply for players selecting "Non-binary" or "Prefer not to say" in gendered formats (Men's / Women's singles)?
* **Options:**
  1. Open/unrestricted registration in any format.
  2. Requirement to play in Open Doubles or Mixed Doubles flights.
* **Current Demo Status:** *Not decided. Stored and presented to organizers only; no automatic registration blockage is enforced.*
