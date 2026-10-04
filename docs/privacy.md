# Privacy

AssetTag Studio processes CSV and Excel files entirely on your device. Import uses a browser worker; preview uses canvas; PDF generation uses local JavaScript. There are no accounts, uploads, analytics, cloud integrations or remote fonts.

Imported records live in memory while this page is open. Only UI preferences are saved to localStorage, never records. Reloading clears the imported dataset. Browser downloads are your own local files; manage them according to your organization's retention requirements.

The static hosting provider receives normal requests for application assets, including IP/user agent metadata. It does not receive spreadsheet contents. Browser extensions or compromised devices can inspect local data; a static app cannot protect against them.

Do not deploy third-party scripts or analytics that inspect inventory. Spreadsheet formulas/macros are never executed. Rendered spreadsheet strings are treated as text. Payload URLs are encoded into codes without fetching them; inspect destinations before scanning unfamiliar labels.

