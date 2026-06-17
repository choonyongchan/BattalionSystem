# Company Setup

Use this guide when adding a new company Sheet to the shared battalion system.

## 1. Create The Company Sheet

1. Clone the existing company Sheet or create a new Sheet with the required core tabs.
2. Keep the shared tab names and headers stable: `Roster`, `Medical`, `Attendance`, `IPPT`, `RouteMarch`, `SOC`, `PolarFlow`, `ConductDetail`, `Appointments`, `Leave`, `MSK`, and `Conducts`.
3. Optional company-only tabs may be added, but battalion rollups ignore them until the shared rollup contract is expanded.

## 2. Install Apps Script

1. Open the company Sheet.
2. Go to Extensions -> Apps Script.
3. Paste `apps-script-Code.gs`.
4. Run `setupCompanyConfig("hercules", "Hercules Company")` for the new company.
5. If the Telegram report-sick bot is used, run `setupBotTabs()` too. The helper is additive and preserves company config columns.
6. Deploy as a web app:
   - Execute as: Me
   - Who has access: Anyone
7. Copy the `/exec` web app URL.

## 3. Register The Company In The Frontend

1. Open `js/companies.js`.
2. Add or update the company entry:

```js
hercules: {
  id: "hercules",
  displayName: "Hercules Company",
  shortName: "Hercules Coy",
  sidebarKicker: "40 SAR HERCULES",
  appName: "Data System",
  reportHeader: "HERCULES COMPANY",
  recruitIdPrefix: "H",
  apiUrl: "https://script.google.com/macros/s/.../exec"
}
```

3. Redeploy the static frontend.

## 4. Generate Invites

In the company Apps Script editor:

```js
generateInvite()
generateBulkInvite(30, 7)
```

Generated links include `?company=<companyId>&token=<token>`, so users land on the correct company and store auth under that company only.

## 5. Configure Battalion Rollup

1. In the company Apps Script editor, run:

```js
setRollupToken()
```

2. Store the printed token securely in the battalion puller configuration.
3. Battalion pullers call:

```text
<company-web-app-url>?action=readRollup&rollupToken=<token>
```

The rollup returns aggregate counts and rates only. It must not contain names, 4Ds, phone numbers, or emails.

## 6. Config Tab Values

The `Config` tab is a wide table. Row 1 contains keys and row 2 contains values. Company settings can coexist with Telegram bot settings.

Common company keys:

- `companyId`
- `companyName`
- `shortName`
- `sidebarKicker`
- `appName`
- `reportHeader`
- `recruitIdPrefix`
- `battalionName`
- `frontendBaseUrl`
- `emailSenderName`
- `fitnessReportSubject`
- `fitnessReportTitle`
- `polarPromptCompanyLabel`
- `telegramFolderName`
- `telegramWelcomeName`
- `enabledFeatures`

Do not put secrets, auth tokens, rollup tokens, or API keys in the Sheet. Use Apps Script Properties for those.
