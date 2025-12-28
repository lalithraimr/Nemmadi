# Nemmadi — Basic mobile MVP (FlutterFlow + Firebase)

Purpose
- Build a very small, mobile-first MVP: onboarding → 1 simple game (Focus & Attention) → micro-survey (PHQ‑4 + PSS‑4 + burnout + emergency question) → summary + tiered recommendation.
- Use FlutterFlow (no-code) for UI and Firebase (free Spark tier for pilot) as backend.

Prerequisites (accounts)
- GitHub account (to hold project)
- FlutterFlow account (free tier) — https://flutterflow.io
- Firebase account (Google) — https://console.firebase.google.com
- (Optional) Local machine with Git if you want to push exported code locally

High-level plan (vertical slice)
1. Create Firebase project, enable Anonymous Authentication, create Firestore DB (Native mode).
2. Create FlutterFlow project and connect it to your Firebase project (Project > Firebase settings).
3. Build 4 screens in FlutterFlow:
   - Onboarding & consent (single-screen, short text, age range, user-type)
   - Mood check-in (emoji slider or color wheel)
   - Game 1 (simple pattern repeat / sequence game; log RT + errors)
   - Conversational micro-survey (PHQ‑4, PSS‑4, burnout single item, emergency question)
   - Summary screen (WellnessScore + tier and actions)
4. Ensure emergency question routes to an immediate crisis screen with helpline and call button.
5. Export project (or preview in FlutterFlow) and store results in Firestore using the schema below.
6. Pilot with 20–100 testers and collect telemetry to tune thresholds.

Firebase setup (step-by-step)
1. Create a new Firebase Project in Firebase Console.
2. Firestore: Create a Cloud Firestore database in Native mode. Start in locked mode (we will deploy rules).
3. Authentication: Enable "Anonymous" sign-in provider.
   - In your app flow, sign-in users anonymously on first run; use request.auth.uid as user id.
4. Storage: (Optional) enable if you will upload attachments — avoid collecting PII.

Collections & data model (suggested)
- users/{userId} — optional minimal profile if you want to store age-range or user-type (keep minimal).
- screening_results/{docId} — one document per completed screening (immutable).
- telemetry/{docId} — fine-grained game trials/events (only writes; admins read).
- aggregates/{id} — created and updated only by Cloud Functions (admin-only).

Sample screening_results document
{
  "userId": "auth:abcd1234",
  "createdAt": "2025-12-28T12:00:00Z",
  "phq4_total": 5,
  "pss4_total": 6,
  "burnout": 1,
  "game1": {
    "mean_error_rate": 0.12,
    "median_rt_ms": 520,
    "rt_sd_ms": 80,
    "dropoff_rate": 0.0
  },
  "game2": {
    "negative_correct_rate": 0.45,
    "positive_correct_rate": 0.60,
    "avoidance_index": 12
  },
  "subscores": {
    "stress": 40,
    "mood": 35,
    "focus": 30,
    "emotion": 45
  },
  "wellnessScore": 65,
  "tier": 1,
  "emergency_flag": false
}

Telemetry event example (telemetry collection)
{
  "userId": "auth:abcd1234",
  "createdAt": "2025-12-28T12:01:10Z",
  "eventType": "game1_trial",
  "payload": {
    "trialIndex": 3,
    "stimulus": "color-sequence",
    "rt_ms": 480,
    "correct": true
  }
}

Firebase security rules (see firestore.rules file included)
- Require authentication (anonymous ok) to write.
- Users can read/write their own user document and create screening_results with userId == request.auth.uid.
- Telemetry writes allowed for authenticated users. Reads limited to admins.
- Aggregates only readable/writable by admins (admins stored in /admins/{uid}).

Deploy Firestore rules (Firebase CLI)
- Install Firebase CLI: https://firebase.google.com/docs/cli
- Login and init (in repo root):
  firebase login
  firebase init firestore
  // put the included firestore.rules into the rules file created by firebase init
- Deploy rules:
  firebase deploy --only firestore:rules

FlutterFlow -> Firebase connection
- In FlutterFlow: Project > Firebase > paste Firebase config (project id, web API key, etc.) as prompted.
- Configure Firestore writes from UI actions:
  - After the survey is completed, add an action to create a document in `screening_results` with the fields listed above.
  - For game events, write small telemetry documents after each trial (be cautious about write limits — batch or sample if needed).
- If FlutterFlow free tier doesn't allow direct writes or code export in your plan, you can:
  - Use FlutterFlow previews to prototype UX.
  - Manually export code (if allowed) and modify the Firebase write code locally.
  - Or implement lightweight REST calls to a Cloud Function endpoint (advanced).

Emergency flow (critical)
- Include mandatory emergency question in the survey:
  "In the last 2 weeks, have you had thoughts that you'd be better off dead, or of hurting yourself?" (Yes / No)
- If Yes:
  - Set emergency_flag = true in screening_results.
  - Immediately show Crisis Screen with:
    - Strong supportive message (non-judgmental)
    - Local crisis helpline number(s) and a "Call now" button (tel: link)
    - "Connect to a counsellor" button (if you provide booking)
  - (Optional) If the user explicitly opts to share contact, trigger a Cloud Function to alert on‑call clinician (requires consent).

Minimal frontend behaviour (FlutterFlow)
- On app start: signInAnonymously() if not logged in.
- Keep flows short: single-question screens and clear microcopy.
- Avoid free-text fields in MVP.
- On survey completion: calculate subscores in client or in a Cloud Function and write final screening_results doc.

Testing & pilot
- Test with friends first (N=5–10).
- Pilot with N=20–100 from target audience.
- Collect completion rate, distribution of subscores, and any offshore issues.
- Tune thresholds only after you have pilot telemetry and clinical review.

Next steps (after vertical slice)
- Add Game 2 and optional Decision task.
- Implement Cloud Function scoring to centralize scoring logic and avoid client-side tampering.
- Add aggregated dashboards (Cloud Function updates `aggregates` collection).
- Add opt-in booking/referral flow and clinician consent mechanism.

Resources & links
- FlutterFlow docs: https://docs.flutterflow.io
- Firebase docs (Firestore rules): https://firebase.google.com/docs/firestore/security/get-started
- Firebase CLI: https://firebase.google.com/docs/cli

If you want I can now:
- Provide the Firebase Firestore rules file (included below) ready to deploy.
- Provide a Cloud Function pseudocode for central scoring & emergency notification.
- Walk step-by-step while you create the Firebase project (I can guide interactively).
