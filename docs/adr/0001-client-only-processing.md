# ADR 0001: Client-only processing

**Status:** Accepted

## Decision

Parse spreadsheets, render labels, and generate PDFs in the browser. Keep imported records in session memory and persist only validated interface preferences.

## Context and consequences

Inventory can be sensitive, and this workflow does not need shared server state. A static app avoids accounts, a backend, and inventory uploads. Users must keep the page open while working, and large workbooks or exports remain bounded by the device's browser memory. Static hosting still receives ordinary requests for app assets.
