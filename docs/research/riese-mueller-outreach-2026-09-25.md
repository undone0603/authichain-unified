# Riese & Müller: manual outreach record

Manual outreach playbook, one prospect. **Status: drafted, not sent.** Waiting for owner approval.

## Contact

| Field          | Value                                                                                                | Source                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Person         | Benjamin Wenz, Corporate Communications & PR                                                         | https://www.r-m.de/de/presse/ (checked live 2026-09-25) |
| Address        | `presse@r-m.de` (press inbox; the page names Wenz as its contact)                                    | same page                                               |
| Provenance     | `published_contact`                                                                                  |                                                         |
| Automated gate | would reject (`presse@` is a role inbox). Fine for a hand-sent first touch addressed to him by name. | `scripts/prospecting/lib/open-prospecting.mjs`          |
| Also named     | Dr. Sandra Wolf, managing partner; Udo Jankowski, managing director                                  | imprint                                                 |

Apollo could not verify a personal address: the current plan has neither Organization Search nor People Enrichment.

## Facts used, and where they come from

| Fact                                                                                                  | Status                     | Source                                          |
| ----------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------- |
| From 2027-02-18, every LMT battery placed on the EU market needs a battery passport                   | verified (regulation text) | Reg. (EU) 2023/1542 Art. 77(1)                  |
| The operator placing the battery on the market assigns the identifier and keeps the passport accurate | verified                   | Art. 77(3)–(4)                                  |
| R&M fits nine Bosch battery models (250–800 Wh, 36 V, 800–1,000 cycles)                               | published by R&M           | r-m.de/en-dk/technology/bosch-system/batteries/ |
| 100% recovery rate for used industrial batteries (previous calendar year, § 15 (3) BattG)             | published by R&M           | imprint                                         |
| Total CO2e down almost 30%; 40% per bike while output rose 20%; ASI-certified recycled aluminium      | published by R&M           | press release, 10 June 2025                     |
| Sandra Wolf's quote on "the most sustainable company in the e-bike industry by 2025"                  | published by R&M           | same press release                              |

## Discrepancies found (these go in the email)

1. **Who owns the passport duty.** Art. 77 puts it on whoever places the battery on the market. For Bosch batteries that is most likely Bosch, not R&M. The draft frames R&M's role as the bike-to-battery link, not the battery passport itself. **Unconfirmed; asked as a question.**
2. **Voltage vs energy.** At the stated 36 V, 36 × Ah falls short of the stated Wh by 2.1–4.9% for 8 of 9 models. The implied voltage averages about 37.4 V. The PowerPack 800 is the only model within 1%. This is likely a different nominal-voltage convention, not an error. Worked out on the passport page from the raw figures.

## Deliverable

Passport draft (private artifact; **share it publicly before sending**, or the link won't open for him):
https://claude.ai/artifact/WcGvVyGmkVtEsf43tN2HCH

## Email (German, to send)

**An:** presse@r-m.de
**Betreff:** Batteriepass für Ihre Bosch-Akkus: ein Entwurf aus Ihren eigenen Daten

Hallo Herr Wenz,

in Ihrer Pressemeldung vom 10. Juni 2025 zum fünften Verantwortungsbericht setzt Dr. Sandra Wolf das Ziel, das nachhaltigste Unternehmen der E-Bike-Branche zu sein. Ab dem 18. Februar 2027 kommt dafür eine neue Pflicht hinzu: Jeder E-Bike-Akku, der in der EU in Verkehr gebracht wird, braucht einen digitalen Batteriepass (Art. 77, Verordnung (EU) 2023/1542).

Ich habe aus dem, was Riese & Müller bereits veröffentlicht, einen Entwurf gebaut, wie dieser Pass für Ihre neun Bosch-Akkus aussehen könnte: [LINK]

Zwei Punkte sind mir dabei aufgefallen:

1. Die Passpflicht liegt beim Unternehmen, das den Akku in Verkehr bringt, bei Bosch-Akkus also vermutlich bei Bosch. Was dann fehlt, ist die Verbindung auf Rad-Ebene: welcher Akkupass zu welcher Rahmennummer gehört, besonders bei DualBattery-Modellen, zusammen mit Ihren eigenen Zahlen wie −40 % CO2e je Bike und dem ASI-zertifizierten Recycling-Aluminium.
2. In Ihrer Akku-Tabelle ergibt 36 V × Ah bei acht von neun Modellen 2 bis 5 % weniger als die angegebenen Wh. Die Wh-Werte entsprechen eher rund 37,4 V. Vermutlich ist das nur eine andere Konvention für die Nennspannung, aber im Pass muss ein eindeutiger Wert stehen.

Vermutlich sind Sie nicht der richtige Ansprechpartner dafür. Wenn es für Ihre Kolleginnen und Kollegen aus Nachhaltigkeit oder Produktcompliance interessant ist, leiten Sie es gern weiter. Falls Sie das vertiefen möchten: Wir bieten eine einmalige EU-DPP-Readiness-Prüfung für 299 USD an. Aber ganz ohne Druck, der Entwurf gehört Ihnen so oder so.

Viele Grüße
[NAME]
AuthiChain
z@authichain.com

## English translation (for review, not to send)

Subject: Battery passport for your Bosch batteries: a draft built from your own data

Hello Mr Wenz,

In your 10 June 2025 press release on the fifth responsibility report, Dr. Sandra Wolf set the goal of being the most sustainable company in the e-bike industry. From 18 February 2027 a new obligation arrives: every e-bike battery placed on the EU market needs a digital battery passport (Art. 77, Regulation (EU) 2023/1542).

I built a draft of how that passport could look for your nine Bosch batteries, using only what Riese & Müller already publishes: [LINK]

Two things stood out:

1. The passport duty sits with whoever places the battery on the market, which for Bosch batteries is probably Bosch. What is then missing is the bike-level link: which battery passport belongs to which frame number, especially on DualBattery models, together with your own figures such as −40% CO2e per bike and the ASI-certified recycled aluminium.
2. In your battery table, 36 V × Ah comes out 2–5% below the stated Wh for eight of nine models. The Wh values fit about 37.4 V. Probably just a different nominal-voltage convention, but the passport needs one unambiguous value.

You are probably not the right person for this. If it is useful to colleagues in sustainability or product compliance, please pass it on. If you want to go deeper, we offer a one-time EU DPP readiness audit for USD 299. No pressure either way; the draft is yours regardless.

Best regards,
[NAME], AuthiChain, z@authichain.com

## Before sending

- [ ] Owner approves the wording
- [ ] Replace `[NAME]` with the sender's name, and `[LINK]` with the passport link once it's shared publicly
- [ ] Send from a monitored inbox (z@authichain.com as reply-to), never `noreply@`
- [ ] Log reply / no reply / bounce here (playbook step 6)

## Log

| Date       | Event                                                                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-25 | Contact found on r-m.de/de/presse; passport draft and email written; Gmail draft created in authichain@gmail.com (draft id r3667980476124479111); not sent |
