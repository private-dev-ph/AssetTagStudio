# Privacy

AssetTag Studio processes CSV and Excel files entirely on your device. Import uses a browser worker; preview uses canvas; PDF generation uses local JavaScript. There are no accounts, uploads, analytics, cloud integrations or remote fonts.

Imported records, transformation previews, bounded undo history and the last successful print snapshot live in memory while this page is open. Reloading clears them. UI preferences and the active printer-profile ID use localStorage. Explicitly saved templates and printer calibration profiles use IndexedDB and contain settings only. Delete saved items from their libraries, or use the explicit library reset when corrupt storage prevents recovery. Browser downloads are your own local files; manage them according to your organization's retention requirements.

Code inspection decodes PNG/JPEG files and camera frames locally in a bounded worker. Nothing is uploaded. Camera access starts only after an explicit Start action, never requests audio, and stops on Stop, navigation/unmount or a background tab. Pasted or decoded URIs are displayed as text and are not opened. Browser permission and a secure origin (HTTPS or localhost) are required for camera use.

The static hosting provider receives normal requests for application assets, including IP/user agent metadata. It does not receive spreadsheet contents. Browser extensions or compromised devices can inspect local data; a static app cannot protect against them.

Do not deploy third-party scripts or analytics that inspect inventory. Spreadsheet formulas/macros are never executed. Rendered spreadsheet strings are treated as text. Payload URLs are encoded into codes without fetching them; inspect destinations before scanning unfamiliar labels.
