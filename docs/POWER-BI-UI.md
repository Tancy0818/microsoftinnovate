# Power BI inside the application

The existing dashboard appearance and operational detail panels remain. The analytics region now has two mutually exclusive modes:

- **Power BI:** a configured private Power BI Service report replaces the React KPI/chart overview. Patient queue, waiting queue, capacity details, patient flow, alerts and task controls remain available in React below the report.
- **Local analytics preview:** the existing clickable cards and charts remain available until publication is configured, or when explicitly chosen. The page labels this as a preview; it is not an embedded Power BI report.

## Connect the published report

### Current deployment status

The report was published successfully to **My workspace** on 29 September 2026.

- [Open the published AcuityCompass report](https://app.powerbi.com/groups/me/reports/b023ed8a-2ef6-4332-b15b-ddecb8368652/overview).
- Report ID: `b023ed8a-2ef6-4332-b15b-ddecb8368652`.
- Verified in Power BI Service: 3,015 arrivals, 9 active patients, 4 waiting patients and 13.64% bed occupancy.
- The user chose free features only and explicitly approved public access to this synthetic report and its underlying dataset. No trial or purchase has been activated.
- **Publish to web is blocked by the organisation:** Power BI displays “Contact your admin to enable embed code creation.” No public embed code was created. Ask the organisation's Power BI/Fabric administrator to allow creation of Publish-to-web codes for this account. The app now accepts the resulting public `https://app.powerbi.com/view?r=...` URL, but the embed setting remains unset until that URL exists.
- Microsoft requires Pro/PPU viewers or qualifying capacity for secure embedding, and an HTTPS host page. See [secure embedding requirements](https://learn.microsoft.com/en-us/power-bi/collaborate-share/service-embed-secure). Verify these before enabling the iframe in the application. The existing HTTP localhost preview remains operational.
- This is a published import snapshot. Automatic cloud refresh from the laptop database has not been configured.

### Remaining connection steps

For the approved free public demo, once the administrator permits code creation, open the published report → File → Embed report → Publish to web (public). Use the resulting `https://app.powerbi.com/view?r=...` URL as `VITE_POWER_BI_EMBED_URL` in `.env`. The app labels this as a public synthetic-data report. Do not later replace its dataset with private or real patient records. Public viewers do not sign in. This route is separate from the private embedding instructions below.

1. Publish the existing report to Power BI Service using the chosen organisation/account. Confirm that viewers have the required permission and licensing.
2. Obtain its **Embed report → Website or portal** URL for private embedding (`https://app.powerbi.com/reportEmbed?reportId=...`). Public URLs are also supported for the explicitly approved synthetic-data demo described above.
3. Set `VITE_POWER_BI_EMBED_URL` in the project root `.env`, using `.env.example` as the template. Do not put passwords, access tokens or client secrets in this variable; frontend variables are visible to browser users.
4. Restart Vite using the local stop/start scripts, or restart the frontend process. Production builds must be rebuilt after configuration changes.
5. Select **PostgreSQL · Synthetic dataset** in the application. It will display the report. The other sources remain clearly labelled local demos.

The iframe uses Microsoft's secure website/portal embedding. Power BI manages sign-in and report permissions. This is not the app-owns-data flow and does not generate embed tokens.

## Behavior

Report filtering happens inside Power BI. Patient searches and actions work against the latest PostgreSQL snapshot. Report date filters do not change the React patient queue. The UI displays this distinction below the report.

The original React KPI click targets are replaced by operational shortcut buttons when Power BI is active. Clicking a Power BI chart filters the report; it does not open a React drawer. Linking Power BI selections to React would need an authenticated SDK integration and explicit field mappings, rather than this secure iframe.

**Refresh data** updates the operational API data. **Reload report** reloads the embedded frame; it does not refresh the imported Power BI semantic model. Refresh/publish in Desktop or configure Power BI Service refresh and a gateway for this laptop database when needed.

A browser cannot inspect cross-origin Power BI content. Frame loading therefore does not prove successful authentication or data loading. Users can open the report separately, reload it, or explicitly switch to local preview; no silent substitution occurs on report errors.
