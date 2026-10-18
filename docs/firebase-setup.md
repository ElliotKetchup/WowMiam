# Firebase setup (Wow Miam)

Project: `wowmiam-2fa59`. Everything below is done once, in the browser. Goal: photo sync on the
Blaze plan while never paying anything — strict rules, a 1 budget, and a kill switch that detaches
billing at 0.50.

## 1. Firestore rules (recipes)

Firestore Database → **Rules** → paste [`app/firestore.rules`](../app/firestore.rules) → **Publish**.

## 2. Blaze plan + Storage (photos)

1. Firebase console → bottom-left **Spark** → **Upgrade** → Blaze → link a card / billing account.
2. **Storage** → **Get started** → production mode → **No-cost locations** (« Emplacements sans frais ») →
   `us-central1`. The free 5 GB only applies to `us-central1`, `us-east1` and `us-west1`; any other
   location is billed from the first byte. (Firestore can stay in Europe, they're independent.)
3. Storage → **Rules** → paste [`app/storage.rules`](../app/storage.rules) → **Publish**.
   Only the owner can read/write their photos, uploads must be images under 1 MB.

## 3. Budget alert at 1

console.cloud.google.com → **Billing** → **Budgets & alerts** → **Create budget**:

- Name `wowmiam-1`, scope: project `wowmiam-2fa59`, all services.
- Amount: **Specified amount = 1** (your account's currency).
- Thresholds: 50 %, 90 %, 100 % of **actual** spend → emails to you.
- Tick **Connect a Pub/Sub topic to this budget** → **Create a topic** → name `budget-kill-switch` → Save.

## 4. Kill switch (detaches billing at 0.50)

Code: [`cloud/budget-kill-switch/`](../cloud/budget-kill-switch/) (`main.py`, `requirements.txt`).

1. console.cloud.google.com → **APIs & Services** → enable **Cloud Billing API**.
2. **Cloud Run** → **Write a function** (Cloud Run functions):
   - Service name `budget-kill-switch`, region `europe-west1`, runtime **Python 3.12**.
   - Trigger: **Add trigger → Pub/Sub trigger** → topic `budget-kill-switch` (accept the prompts to enable Eventarc / Pub/Sub APIs).
   - Authentication: require authentication (the trigger handles it).
   - Create, then in the inline editor replace `main.py` and `requirements.txt` with the repo files,
     set **Function entry point** to `stop_billing`, **Save and redeploy**.
   - Optional env vars: `KILL_AT` (default `0.5`), `PROJECT_ID` (default `wowmiam-2fa59`).
3. Give the function the right to detach billing. Its service account is shown on the function's
   **Security** tab (usually `<project-number>-compute@developer.gserviceaccount.com`):
   - **Billing** → **Account management** → **Add principal** → that service account → role **Billing Account Administrator**.
   - **IAM & Admin → IAM** (project `wowmiam-2fa59`) → **Grant access** → same account → role **Project Billing Manager**.
4. Test the wiring without killing anything: **Pub/Sub** → topic `budget-kill-switch` → **Messages** →
   **Publish message** with body `{"costAmount": 0.01, "budgetAmount": 1, "currencyCode": "EUR"}`.
   The function's **Logs** should say `Spend 0.01 EUR is under 0.50: nothing to do.`

If it ever fires: photos and sync stop (Storage needs billing), Firestore drops back to the free
Spark quotas, nothing is charged further. Check the budget emails, then re-attach billing from
Firebase → Usage and billing. Re-attach within a few days so Storage keeps the photos.
