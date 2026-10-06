# AcuityCompass: teacher demonstration

## Show website changes in Power BI (now connected)

Open `powerbi/AcuityCompass.pbip` and select **Combined ED dashboard**. This new report page reads the same saved registrations and events as the website, through `reporting.interactive_patients`. The September report remains on **ED overview**.

For the demo: note Current active, add a fictional patient through the website's **+ Add patient**, return to Desktop and click **Home > Refresh**. Entered visits, Current active and Current waiting increase. Assign a bed through patient updates, refresh Desktop again, and Current occupancy changes. Discharge or transfer the patient and refresh to show the bed released and Completed departures increased. The refresh timestamp identifies the last database read.

This works locally without public-embedding permission or a paid plan. It is an Import report requiring manual refresh, not automatic streaming. The published online copy has not been republished with this page. Earlier references in this guide to historical-only BI are superseded by this section.

## Start before presenting

Double-click `Start AcuityCompass.cmd` in the project folder. It starts the existing local database, API and website, then opens http://127.0.0.1:5173/. Keep the services running while presenting. This link works on this laptop only.

Open `powerbi/AcuityCompass.pbip` in Power BI Desktop separately. The administrator restriction concerns public web embedding, not the local report. If Desktop needs data, start the database first and use Refresh. Do this before presenting. No trial or paid plan is required for the local demonstration.

## Three-minute demonstration

1. Select **PostgreSQL · Synthetic dataset**. Explain: “These are fictional historical records, loaded from PostgreSQL through our backend.” Show the snapshot date.
2. Open **Patient flow**. Show **Time in stage**. Explain: “This uses the current stage's recorded start time and ends at the snapshot.” The average elapsed wait KPI still means time since arrival for currently waiting patients; it is a different metric.
3. Close the details and open **Transfer follow-up** near the bottom of the page. Select **SYN-02997**, the patient awaiting a bed in the current dataset.
4. Select a blocker and responsible team, add an explicitly fictional note, and save. An initial labelled rehearsal entry may already be present. Explain that blockers are user-recorded, not inferred automatically.
5. Close the drawer, select **Refresh data**, reopen it and show that the saved update remains. Open the patient's update history. **Open handover items only** excludes closed follow-ups.
6. Optionally close a follow-up with a completion note. Closing coordination work does not move a patient or free a bed. The historical patient record remains unchanged.
7. Switch to **Demo · High demand** to show explainable alerts. Clearly say this is a separate simulated scenario and its edits reset when you switch sources.
8. Switch to Power BI Desktop. Show arrivals across dates and capacity at the latest selected snapshot. Say: “The report works separately today. Publishing it inside the website requires administrator permission.” The website's **Open Power BI report** link is an alternative for the signed-in report owner with internet access.

## What works now

- One-page React UI, patient queue, recorded patient timelines and local charts.
- PostgreSQL-backed reads, acknowledgements and operational task status.
- Recorded current-stage duration for database patients; illustrative stage durations for demo scenarios.
- Transfer blocker, team ownership, status, timestamped history and open-item handover filtering.
- Validation and stale-edit rejection for transfer updates.
- Power BI report, presented separately in Desktop or the owner's signed-in service account.

## What remains future work

Live hospital ingestion, authenticated users, actual transfer-request timestamps, forecasting, and Power BI analytics of the new follow-up and interactive records. Patient-entry forms now work in the separate Interactive synthetic demo described below. Follow-up history records when a note was entered today against a historical snapshot; it does not establish clinical delay or treatment effectiveness.

## Interactive registration and movement demonstration

**Main-page integration:** use the **+ Add patient** button in the dashboard header. Registration and movement now open in the existing detail panel without replacing the main page. The active source switches to saved interactive records, and saving refreshes the main cards, flow/urgency charts, capacity and arrival/departure history. Open the active-patient card to update a visit. Historical records remain selectable separately. Power BI still uses its existing historical model.

1. Select **Interactive synthetic demo · Patient entry** from Data source, or use **Add / update fictional patients**. The September records remain in the historical dashboard.
2. Select **Add patient**. Keep the arrival time or enter a past time within 30 days. The field uses your laptop's timezone. Choose arrival method and initial area; triage may remain **Not assessed**. Register to create an automatic `DEMO-...` visit ID.
3. Open that ID. Set Next stage to **Triage** and select a recorded triage category. Save.
4. Select **Assessment**, choose **Examination**, and assign an available bed. Save. Occupied beds increase and the patient leaves the awaiting-assessment count.
5. Select **Treatment**, then **Discharged**, saving each change. Discharge releases the bed and removes the patient from the active count. The simplified demo also supports Transferred as a terminal outcome.
6. Enable **Include discharged and transferred visits** to inspect the retained history. Refresh interactive data to show persistence. Returning to the historical dashboard and reopening interactive mode also preserves saved data.

Subsequent stage-update timestamps are automatic when saved; only arrival supports late entry in this version. Stage transitions are simplified prototype rules, not clinical guidance. Same-stage bed or triage updates do not restart the stage clock. No personal names or contact details are collected. The existing Power BI report continues to use historical data only.

## If a service fails

Run the launcher again; it preserves running services. If the website loads but the backend is unavailable, show the explicit error and use a labelled demo source temporarily. Do not call demo numbers database records. Power BI Desktop with a saved imported model is the separate reporting fallback; verify it opens before presenting.

## One-sentence explanation

“AcuityCompass helps an ED coordinator inspect patient flow, understand rule-based warnings and record who is following up on a transfer issue, while Power BI supports historical analysis.”

### Demonstrate patient flow

Open patient registration & movement on the main page, select a visit ID, and use Coordinator action. Record triage (choose an assessed category), then Start assessment and assign an available ED bed. Request admission: the patient stays active and keeps their bed. Then choose Left ED — admitted to inpatient ward, enter the ward, confirm physical departure, and Record departure. Active patients and occupied beds decrease; Include all departed visits reveals the timestamped history. You can also record discharge, transfer to another hospital (destination required), or departure before completing care. In Power BI Desktop, Home > Refresh updates Combined ED dashboard. Its Completed departures card includes all types of ED departure, not only completed treatment.

### Combined records update
Use Combined patient records (the default). Original September patients still in the ED and new website entries share the same queue, bed capacity, and movement controls. Search SYN-03009 for an original treatment patient. Include all departed visits searches the full original history too. Dates remain historical; describe this as continuing a synthetic September snapshot. In Power BI, Combined ED dashboard now shows the combined ledger after Refresh; ED overview is still the historical report.
