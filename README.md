# Hercules Company Dashboard

Company admin for 40SAR Hercules: daily parade state, report sick, nominal roll, off and leave balances, duty roster and conduct tracking, all in one page.

Developers: see [docs/DeveloperGuide.md](docs/DeveloperGuide.md).

## Signing in

Open the site. The landing page has the commander sign-in. Enter the company password and press **Sign in**.

After 3 wrong passwords the form locks for 30 seconds.

Once you are signed in, the same page becomes the workspace. **Sign Out** is at the top right.

## The workspace

Tabs are grouped by what you are doing. The open tab is kept in the address bar (e.g. `?tab=rsi`), so you can bookmark or share a tab. Use the arrow keys to move between tabs.

### Daily

**Parade State** has four steps along the top:

1. **Config**: check the parade times. Override a platoon's strength if the roll is not right for today. Changes save when you leave the cell.
2. **Duties**: pick a day from the week strip and set who is on each duty. Add Guard Duty (any number of people) in its own panel.
3. **Exceptions**: everyone not on parade, e.g. MC, leave, off, courses and statuses. Search, sort, edit inline, or add one with the form.
4. **Generate**: choose the parade and press **Generate**. Copy the report text and paste it into WhatsApp. The report is always for today.

**RSI**: key in who reported sick and why. Each entry also appears on the parade state and in conducts. Copy the generated RSI message.

### Personnel

**Nominal Roll**: everyone in the company by platoon and rank.

- Add one soldier with the form, or bulk import a CSV from the Google Sheets template. The template needs the columns `4D`, `Rank`, `Name` and `Platoon`. Existing names are updated, not duplicated.
- Click a soldier to open their sheet. It shows current, upcoming, past and revoked exceptions. From there you can add, edit, end today, revoke or delete an exception.

**Off/Leave**: each soldier's off and leave balance. Add, edit or remove a balance.

### Duty & training

**Duty Dashboard**: duty points per person. Each duty is weighted by type and by day (weekday, weekend or public holiday). Use it to share duties fairly.

**Conducts**: create a conduct (e.g. IPPT, route march) with its date and time.

- People on an exception that day fall out automatically.
- Make a call for anyone flagged for the commander's decision.
- Copy the conduct state when done.

## Settings

Open **Settings** (gear icon, top right).

| Tab | What it controls |
|---|---|
| Duty Weights | Points per duty type and the weekday, weekend and holiday multipliers |
| Parade Times | First and last parade times shown in the report |
| Duty Eligibility | Which ranks can do each duty, plus named exceptions |
| Guard Duty Roles | Which ranks can fill each Guard Duty role |
| Absence Defaults | Whether each exception type counts as absent by default |
| Public Holidays | Holidays for the whole battalion. **Sync Singapore Holidays** adds the year's SG holidays; you can also add or delete one by hand. |

Public holidays are shared by every company, so a change here affects everyone's duty points.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Not available yet" | That company is switched off. Go to the main page. |
| Sign-in is locked | Wait 30 seconds, then try again. |
| Duty points look wrong on a holiday | Check Settings → Public Holidays has that date. Sync the year if it is missing. |
| Parade strength does not add up | A warning shows next to the count. Check Config for a strength override, and the Nominal Roll for missing people. |
| Data stops loading or saving | Your session may have expired. Sign out, sign in again and reload. |

## Roadmap

- Integrate a battalion tracking system.
- Company Dashboard: add Absence and Status leaderboards, ingested from WhatsApp.
- Battalion Dashboard: add Absence and Status leaderboards, ingested from WhatsApp.
