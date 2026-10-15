# TERRAFORM — The System Awakens

> A survivor wakes on unknown land with no lab, no instruments and no farming knowledge.
> TERRAFORM guides them from **first observation to harvest** — answering **only from a cited,
> structured knowledge base (KB)**. Two interfaces share one backend and one session:
> a **cozy 3D Explorer game** and a **professional Field Dashboard**.

**Scenario:** 5 — Lateritic Hardpan Plateau (hardpan + acidity, short intense wet season).

---

## 1. Install & run locally

### Requirements
| Tool | Version | Check |
|---|---|---|
| Python | **3.12** (3.11+ works) | `python --version` |
| Node.js | **22** (20+ works) | `node --version` |
| npm | comes with Node | `npm --version` |
| Git | any recent | `git --version` |

### First-time setup
**Backend**
```powershell
cd terraform-fireredackend
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt   # runtime deps (requirements.txt) + pytest
copy .env.example .env                # macOS/Linux: cp .env.example .env  (optional: add OPENAI_API_KEY)
```
**Frontend**
```powershell
cd terraform-fireredrontend
npm ci                                # exact versions from package-lock.json
copy .env.example .env                # optional; default backend is http://127.0.0.1:8000
```

### Run (two terminals)
```powershell
# Terminal 1 — backend on http://127.0.0.1:8000
cd backend; .\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2 — frontend on http://localhost:5173
cd frontend
npm run dev
```
Check: <http://127.0.0.1:8000/api/health> → `kb_loaded: true`, `kb_errors: []` · API docs: <http://127.0.0.1:8000/docs> · App: <http://localhost:5173>

### Tests & production build
```powershell
cd backend;  .\.venv\Scripts\python -m pytest -q        # 108 tests, never call OpenAI
cd frontend; npm run build; npm start                       # production server on http://localhost:4173
```

| File | Purpose |
|---|---|
| `backend/requirements.txt` | pinned runtime dependencies (what Render installs) |
| `backend/requirements-dev.txt` | runtime + test dependencies (local) |
| `backend/.env.example` | every backend setting, documented |
| `frontend/package.json` + `package-lock.json` | pinned frontend dependencies (`npm ci`) |
| `frontend/server.mjs` | zero-dependency production server (static files, SPA fallback, `/config.js`, `/healthz`) |
| `render.yaml` | Render Blueprint for both web services |
| `.python-version` | tells Render to use Python 3.12.5 |

---

## 1b. Deploy to Render (two web services)

The repo contains a **Render Blueprint** (`render.yaml`) that creates both services:

| Service | Runtime | Build | Start | Health |
|---|---|---|---|---|
| `terraform-api` | Python 3.12 | `pip install -r backend/requirements.txt` | `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT` | `/api/health` |
| `terraform-web` | Node 22 | `cd frontend && npm ci && npm run build` | `cd frontend && npm start` | `/healthz` |

**Steps**
1. Push this folder to a GitHub (or GitLab) repository:
   ```powershell
   cd terraform-firered
   git init -b main          # already done if .git exists
   git add -A
   git commit -m "TERRAFORM: deployable build"
   git remote add origin https://github.com/<you>/terraform.git
   git push -u origin main
   ```
   `.gitignore` already excludes `.env` (your OpenAI key), `.venv`, `node_modules`, `dist`, uploads and session data.
2. Render dashboard → **New → Blueprint** → choose the repo → Render reads `render.yaml`.
3. When asked for the secret values:
   - `OPENAI_API_KEY` (terraform-api) → your key, or leave empty to run KB-only without OpenAI.
   - `API_BASE_URL` (terraform-web) → the backend URL, e.g. `https://terraform-api.onrender.com`
     (copy it from the terraform-api service page; you can set it after the first deploy — it is read at **runtime**, a restart is enough, no rebuild).
4. Wait for both deploys to go green, then open the **terraform-web** URL.
5. Check `https://<terraform-api>.onrender.com/api/health` → `kb_loaded: true`, `kb_errors: []`.

**CORS:** the backend allows `https://terraform-web*.onrender.com` via `CORS_ORIGIN_REGEX`. If you rename the
frontend service or add a custom domain, put that origin in `FRONTEND_ORIGIN` (comma-separated list allowed).

**Good to know (free plan)**
- Free services sleep after ~15 min idle; the first request then takes ~30–60 s. Open both URLs a minute before a demo.
- The disk is ephemeral: uploaded photos and saved sessions (`backend/uploads`, `backend/data`) reset on each deploy/restart.
  The knowledge base is in the repo, so it never resets. For permanent sessions add a Render Disk mounted at
  `/opt/render/project/src/backend/data` (paid plans) and set `DATA_DIRECTORY` / `UPLOAD_DIRECTORY` to it.
- Run one backend instance (the JSON session store is single-process).
- Turning OpenAI off: set `ENABLE_LLM_REWRITE=false` and `ENABLE_VISION=false` on terraform-api.

---

## 2. The non-negotiable rule: KB-only answers

| Layer | What it may do | What it may NOT do |
|---|---|---|
| `knowledge_base/*.json` | Hold every agricultural fact, amount, crop, care step, pest option, harvest cue, with `source_ids` + `evidence_level` | — |
| Backend (FastAPI) | **Select and combine** KB records by tags (`applies_when`), score crops transparently, validate every ID | Author agricultural advice in Python |
| Frontend (both modes) | Render API responses; show KB IDs as clickable evidence | Contain any crop/treatment/care text |
| Optional OpenAI layer | Re-word already-selected summaries; suggest *visible* photo cues from an allow-list | Add facts, numbers, crops, sources. Output is validated; on any failure → deterministic |

* Every recommendation carries `evidence: { kb_ids, source_ids }`. Click any chip → the **Evidence drawer** shows the full KB record and its sources (with `fetched_and_read` / `recorded_not_fetched` honesty flags).
* The assistant / robot (`POST /api/assistant/ask`) answers with verbatim KB text or refuses:
  *"The knowledge base does not contain enough information to answer this safely."* + a suggested no-lab check.
* No lab readings, no pH numbers, no kg/cm/litres. Amounts are everyday: *a forearm wide, knee-high, a bucketful, a hand's depth, a few paces, a finger-joint deep*.
* Unknown stays unknown: missing fields become `*_unknown` tags, never `false`.
* The app works fully **without** an OpenAI key (`generation_mode: "deterministic"`).

---

## 3. How it maps to the official 9-stage rubric

The UI has 10 steps: an intake (Observation log) + the 9 rubric stages, labelled "Protocol 01–09".

| Rubric stage | TERRAFORM step | What the system does (all from KB) |
|---|---|---|
| — Intake | 1 Observation log | Free text + optional photo + optional chips (all optional except description). Example loaders for the standard case and variations |
| **01 Input echo** | 2 Input echo | Verbatim text, faithful summary built only from detected cue labels, "You observed" vs "Not provided yet", photo status (honest), local advice kept as *a claim to check* |
| **02 Missing analysis** | 3 Missing analysis | Soil archetype match (strong/partial/weak, "not a lab diagnosis"), **root causes / failure factors** (Observed vs Likely-inferred vs Not indicated), unknowns, no-equipment checks with outcomes that feed back into the plan |
| **03 Fix protocol** | 4 Fix protocol | Do first / Do next / Avoid, everyday quantities, safety notes, "Why this plan" adaptations, completable tasks — all **before** crops |
| **04 Next action** | 5 Next action | **Readiness gate with empirical pass/fail tests** (bucket infiltration by next morning, squeeze/crumb test, stone lines after heavy rain, moisture under mulch, soil moist to the hard layer after soaking rains). Planting unlocks only when task done **and** test passed (or risk explicitly accepted) |
| **05 Crop suggestions** | 6 Crop suggestions | Ranked field crops with transparent score breakdown vs. site tags, compare view, trees shown separately as long-term options, exclusions with reasons, small-trial advice |
| **06 Timeframe** | 7 Timeframe | **Dual timeline**: remediation/prep weeks + late-start buffer + crop maturity range, compared with the user's wet-season estimate; "unknown" when not estimated (no invented dates) |
| **07 Planting method** | 8 Planting method | Pits / raised beds / containers / stone lines / half-moons, sowing depth (finger-joints) and spacing (hand-spans), **irrigation matched to scarce water** (buried clay pot, bottle drip, mulched basin, base watering at cool times) |
| **08 Ongoing care** | 9 Ongoing care | Growth-stage timeline, organic fertility, **stress mitigation** (heat, hot wind/windbreaks, dry spell, waterlogging, washout, acidity, nutrient), pest watch with low-risk bio-options + safe-use cautions, journal |
| **09 Harvest & regen** | 10 Harvest | See/feel ripeness cues, harvest method, drying/storage, what not to store, residue return, cover crop, preserving beds/windbreaks, extending pits & stone lines, completion summary + evidence ledger |

---

## 4. Generalization: the unseen-variation demo

The same engine reasons from tags, so the plan **changes** with the land. Verified on the live API:

| Input change | What changes in the plan |
|---|---|
| "A continuous sheet of rock blocks digging everywhere" | Planting pits removed; containers + raised beds; "avoid deep pits on a sheet" added; trial plot gate becomes required; pigeon pea & mango excluded; trees high-risk |
| "Completely flat, water pools in low places" | Stone lines removed; overflow/drainage planning; "avoid trapping water on flat ground"; pooling gate replaces runoff gate; waterlogging stress + failure factor appear |
| Gentle slope / unknown slope | Contour stone lines (+ half-moons on gentle slopes), runoff gate |
| "Locals say only tree crops grow here" | Kept as a *claim to check*; conflict + local-advice note; trial plot; field crops still offered as a small trial |
| "No compost, very little water" | Compost replaced by leaf-litter / residue alternatives; water-hungry and vulnerable crops penalized; trial advice |
| Wet season estimate (e.g. 14 weeks) | Season fit per crop: fits / tight / high risk (maturity + buffer vs window) |
| Photo attached, vision off | "Photo attached; visual analysis is not enabled. The text description was used." |
| Off-topic question ("can I grow wheat?") | Refused — not in the KB |

Every change is listed in the **"Why this plan"** panel with the KB IDs that caused it.

---

## 5. Demo script for judges (≈5 minutes)

1. Landing → status pills show *Backend online · KB v1.1.0 · KB-only mode*.
2. **Enter the Valley** → intro: walking to college, a hooded stranger offers a game, you lose, you wake on red laterite; TERRA boots ("I can only speak from my knowledge base"). (Skip with **Esc**.)
3. Walk (WASD/Shift) to the **Observation Board** (E) → load the standard example → analyse.
4. **Soil Inspection Patch** → echo + checks → generate plan. TERRA now guides to the next station.
5. Mark a task at the **Compost Station** / **Stone-Line Terraces** (farming animation plays).
6. Click **Dashboard** → same session: walk Steps 2–10, open an Evidence chip, record a gate test Pass/Fail, compare crops, view the dual timeline.
7. Back on Step 1, load **Variation: rock sheet** (or flat & pooling) → regenerate → show "Why this plan" and the changed Do-first / Avoid lists.
8. Ask TERRA "can I grow wheat here?" → refused (not in KB). Ask "how do I protect cowpea from aphids?" → KB answer with IDs.

---

## 6. Architecture

```
React + Vite (TypeScript, Tailwind v4, Zustand)
 ├── Landing / Field Dashboard (10 steps, evidence drawer, assistant panel)
 └── Intro cinematic + 3D Explorer (React Three Fiber + Drei, Kenney CC0 .glb)
        │  one shared Zustand session store (persisted) — mode switch keeps state
        ▼  src/api/terraformApi.ts (single typed client, timeouts, error parsing)
FastAPI (backend/app)
 ├── services/kb_loader.py     load + validate KB at startup (ids, references, envelopes)
 ├── services/tagging.py       observation → tags via KB cue keywords / field mappings
 ├── services/reasoning.py     input echo, archetype, failure factors, unknowns, checks, conflicts
 ├── services/planner.py       fix protocol, gate, crop scoring, timeframe, planting, care, harvest
 ├── services/assistant_search.py  KB-only Q&A with refusal threshold
 ├── services/llm_rewriter.py  optional grounded re-wording (validated, falls back)
 ├── services/vision.py        optional photo cue suggestions (allow-listed tags, user confirms)
 └── services/store.py         JSON-file sessions/plans (atomic writes)
knowledge_base/*.json          the only source of agricultural truth (+ sources.json)
```

Shared contract: [`CONTRACT.md`](CONTRACT.md) (endpoints, shapes, tag vocabulary, KB schema).

### Endpoints
`GET /api/health` · `GET /api/knowledge/scenarios[/{id}]` · `GET /api/knowledge/records/{kb_id}` · `GET /api/knowledge/sources` · `GET /api/knowledge/stats` ·
`POST /api/sessions` · `GET|PUT /api/sessions/{id}` · `POST /api/uploads/land-photo` · `GET /api/uploads/{id}` · `POST /api/uploads/{id}/analyze` ·
`POST /api/observations/analyze` · `POST /api/plans/generate` · `GET /api/plans/{id}` · `PATCH /api/plans/{id}/progress` · `POST /api/assistant/ask`

---

## 7. Knowledge base

`knowledge_base/` — original synthesis written by the team, cited in `sources.json` (FAO, UNCCD, TNAU, ICRISAT/CGIAR, extension services…).
Each source is flagged `fetched_and_read` or `recorded_not_fetched`; unsourced content is marked `needs_local_confirmation`.
See [`knowledge_base/README.md`](knowledge_base/README.md) for the schema and how to add a scenario.

Collections: scenario (archetype, signals, unknowns, failure factors, readiness gate with pass/fail tests) · observation_cues · diagnostic_checks · soil_treatments · crop_profiles · planting_methods · care_stages · stress_mitigation · pest_management · harvest_profiles · regeneration · timeframe_rules · sources.

---

## 8. Optional OpenAI features (off by default)

Copy `backend/.env.example` → `backend/.env`:
```dotenv
OPENAI_API_KEY=sk-...
OPENAI_MODEL=<a text model your account supports>
ENABLE_LLM_REWRITE=true          # friendlier wording of KB summaries only
ENABLE_VISION=true               # tentative visible photo cues, user must confirm each
OPENAI_VISION_MODEL=<a vision-capable model>
```
Keys live only in the backend. Never put secrets in `VITE_*` variables.

---

## 9. Two laptops on one network (optional)

1. Run the backend on laptop A with `--host 0.0.0.0` (only on a permitted private network).
2. On laptop B set `frontend/.env` → `VITE_API_BASE_URL=http://<laptop-A-LAN-IP>:8000` and set backend `FRONTEND_ORIGIN` to laptop B's origin.
3. Test `/api/health` from laptop B first. If the network is unreliable, run both on one laptop.

---

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| Dashboard says *Backend offline* | Start Terminal 1; check <http://127.0.0.1:8000/api/health> |
| Port already in use | Another app holds 8000/5173 — stop it or change `--port` / `VITE_API_BASE_URL` |
| `kb_errors` not empty in health | A KB file has a broken reference — the message names the record and field |
| 3D valley slow | Use the Dashboard (same data); close other GPU-heavy apps |
| Want to restart the story | Explorer menu (Esc) → *Replay intro*, or Landing → *Clear session* |
