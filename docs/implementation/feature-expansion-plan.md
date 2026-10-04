# AssetTag Studio — Feature Expansion Plan

This document is a companion to the original **AssetTag Studio End-to-End Project Plan**. It focuses on features that expand AssetTag Studio from a label generator into a broader **physical asset identity toolkit**.

> **Product direction:** Create, validate, encode, print, and exchange physical asset identifiers without requiring a backend.

## 1. Expansion goals

The expanded workflow should become:

```text
Messy asset data
      ↓
clean structured identities
      ↓
printable labels
      ↓
validated QR / barcode payloads
      ↓
portable manifests
      ↓
optional FieldLens integration
```

New features should remain browser-first, privacy-friendly, statically deployable, useful without accounts, compatible with CSV/XLSX, and modular enough to ship independently.

## 2. Recommended roadmap

### V1.5
1. Asset ID Generator
2. Data Health
3. Template Save / Import / Export
4. QR Payload Builder

### V2
1. Location Labels
2. Cable Labels
3. Printer Calibration
4. Code Inspector

### V2.5
1. Serial Tools
2. Asset Manifest Generator
3. FieldLens Export
4. Printer Profiles

---

## 3. Asset ID Generator

### Purpose

Create consistent identifiers before printing.

Example pattern:

```text
{department}-{type}-{sequence}
```

Output:

```text
ENG-PC-001
QA-PC-001
PROD-PC-001
```

### Capabilities

- static prefix and suffix
- sequential numbering
- configurable zero padding
- source-column interpolation
- date/year tokens
- duplicate prevention
- preview before applying
- generate only for blank IDs
- explicit confirmation before overwriting IDs

Suggested tokens:

```text
{site}
{department}
{type}
{year}
{sequence}
```

### Acceptance criteria

Users can define a reusable ID pattern, preview generated values, detect duplicates, generate IDs for selected rows, undo changes before export, and immediately use the new IDs in labels.

---

## 4. Data Health

### Purpose

Audit imported asset data before label generation.

Example:

```text
Asset Data Health

248 records

✓ 241 valid

Warnings
────────────────────
3 duplicate asset IDs
2 missing serial numbers
1 duplicate serial number
1 empty asset name
```

### Checks

- duplicate IDs
- duplicate serials
- blank identifiers
- blank names
- empty rows
- empty columns
- duplicate columns
- leading/trailing whitespace
- inconsistent casing
- suspiciously long values
- invalid QR payload source values

### Safe fixes

```text
Trim whitespace
Normalize header names
Remove empty rows
Remove empty columns
Normalize casing
Generate missing IDs
```

All fixes should be previewable and reversible.

---

## 5. Template Save / Import / Export

### Purpose

Allow reusable label layouts without requiring accounts.

Example file:

```text
company-standard.assettag.json
```

Example structure:

```json
{
  "version": 1,
  "name": "Company Standard Asset Label",
  "label": {
    "widthMm": 60,
    "heightMm": 30,
    "paddingMm": 3
  },
  "code": {
    "type": "qr",
    "field": "asset_id"
  },
  "fields": [
    {
      "source": "name",
      "fontSize": 12,
      "weight": "bold"
    },
    {
      "source": "asset_id",
      "label": "Asset:"
    }
  ]
}
```

### Capabilities

- save locally
- export JSON
- import JSON
- duplicate template
- rename template
- delete local template
- built-in presets

Built-in presets can include Standard Asset Tag, Small Equipment Tag, IT Laptop Label, Cable Label, Warehouse Bin Label, and Location Label.

---

## 6. QR Payload Builder

### Purpose

Encode structured payloads rather than only raw values.

Supported modes:

```text
PC-001
```

```text
https://assets.example.com/assets/{asset_id}
```

```text
fieldlens://asset/{asset_id}
```

```text
ASSET:{asset_id}|SERIAL:{serial}|SITE:{location}
```

### Validation

Detect missing referenced fields, empty values, excessive payload length, malformed URLs, unsupported schemes, and QR density concerns.

### Acceptance criteria

Users can visually insert spreadsheet fields, preview output live, choose presets, and validate payloads before PDF generation.

---

## 7. Location Labels

### Purpose

Generate labels for racks, shelves, bins, rooms, and other physical locations.

Example hierarchy:

```text
Warehouse A
 └─ Rack A
     └─ Shelf 03
         └─ Bin 07
```

Suggested payload:

```text
location://warehouse-a/rack-a/shelf-03/bin-07
```

Capabilities include hierarchy fields, high-contrast layouts, large readable text, optional parent locations, QR payload templates, and batch generation.

---

## 8. Cable Labels

### Purpose

Create narrow labels for cables, patch cords, and ports.

Input:

```csv
source,target,port
SW01,SERVER01,G12
SW01,SERVER02,G13
SW02,AP01,G04
```

Examples:

```text
SW01 → SERVER01
G12
```

```text
| SW01-G12 | SERVER01 |
```

Capabilities include narrow presets, mirrored wrap labels, source/target fields, ports, direction formatting, and optional QR/barcodes.

---

## 9. Printer Calibration

### Purpose

Compensate for real printer and sheet alignment differences.

Workflow:

```text
Print Calibration Page
        ↓
Measure X/Y difference
        ↓
Enter correction
        ↓
Apply to sheet layout
```

Example:

```text
Horizontal Offset
+1.5 mm

Vertical Offset
-0.8 mm
```

The calibration page should include corner markers, a center crosshair, ruler marks, a reference box, and simple instructions.

---

## 10. Printer Profiles

Save calibration per printer.

Example:

```text
Office HP LaserJet
X: +1.2 mm
Y: -0.5 mm
```

```text
Warehouse Zebra
X: 0 mm
Y: +0.7 mm
```

Profiles should support create, rename, active selection, export/import, and reset. They must never contain imported asset data.

---

## 11. Code Inspector

### Purpose

Validate QR and barcode content before or after printing.

Example:

```text
CODE INSPECTOR

Type:
QR Code

Payload:
fieldlens://asset/PC-0042

Detected Scheme:
fieldlens

Asset ID:
PC-0042

✓ Valid FieldLens Asset URI
```

Input methods:

- uploaded image
- camera
- pasted text
- current generated label

Checks:

- format detection
- decoded content
- payload length
- printable characters
- URI scheme
- FieldLens URI validity
- duplicate payloads

---

## 12. Serial Tools

### Purpose

Normalize and validate serial-number data.

Example:

```text
 Czc91237
CZC-95821
sn: CC10042
```

becomes:

```text
CZC91237
CZC95821
CC10042
```

Tools:

```text
Normalize
Validate
Extract
Deduplicate
```

Rule support:

- prefix stripping
- whitespace removal
- separator removal
- casing
- fixed-length rules
- regex validation
- known prefixes
- custom patterns

All transformations should preview first and preserve original values until explicitly applied.

---

## 13. Asset Manifest Generator

### Purpose

Create a machine-readable record of exactly what was printed.

Example:

```json
{
  "generatedAt": "2026-10-04T12:00:00Z",
  "template": "Standard Asset Tag",
  "codeType": "qr",
  "encodedField": "asset_id",
  "records": [
    {
      "assetId": "PC-001",
      "labelIndex": 1,
      "page": 1,
      "position": {
        "row": 1,
        "column": 1
      },
      "payload": "fieldlens://asset/PC-001"
    }
  ]
}
```

Export formats:

```text
JSON
CSV
```

Potential uses include audits, print-job recreation, inventory synchronization, FieldLens imports, and label verification.

---

## 14. FieldLens Export

### Purpose

Provide a direct bridge from AssetTag Studio to FieldLens.

Workflow:

```text
Import asset spreadsheet
        ↓
Clean data
        ↓
Generate asset IDs
        ↓
Select FieldLens preset
        ↓
Generate labels
        ↓
Export:
  fieldlens-labels.pdf
  fieldlens-assets.csv
```

Recommended QR format:

```text
fieldlens://asset/{asset_id}
```

Initial export fields:

```text
asset_id
name
asset_type
serial
location
```

The label PDF and data export must use identical asset IDs.

---

## 15. Expanded navigation

Recommended future navigation:

```text
ASSETTAG STUDIO

Create
├── Asset Labels
├── Cable Labels
├── Location Labels
└── QR / Barcode

Data
├── Import
├── Data Health
├── Asset ID Generator
└── Serial Tools

Design
├── Templates
├── Sheet Layout
└── Printer Calibration

Tools
├── Code Inspector
├── Manifest Generator
└── FieldLens Export
```

Keep Asset Labels as the default entry point.

---

## 16. Shared architecture

Do not create isolated implementations for each studio mode.

```text
Import Layer
    │
    ▼
Normalized Dataset
    │
    ├───────────────┐
    │               │
    ▼               ▼
Data Health     ID Generator
    │               │
    └──────┬────────┘
           ▼
     Working Dataset
           │
           ├───────────────┐
           │               │
           ▼               ▼
     Label Engine      Serial Tools
           │
           ▼
     Payload Builder
           │
     ┌─────┴─────┐
     ▼           ▼
    QR        Barcode
     │           │
     └─────┬─────┘
           ▼
      Layout Engine
           │
     ┌─────┴──────┐
     ▼            ▼
 PDF Export    Manifest
```

Reuse field resolution, payload interpolation, unit conversion, page layout, code rendering, validation, and template serialization.

---

## 17. Suggested module structure

```text
src/
├── features/
│   ├── import/
│   ├── data-health/
│   ├── id-generator/
│   ├── serial-tools/
│   ├── payload-builder/
│   ├── asset-labels/
│   ├── cable-labels/
│   ├── location-labels/
│   ├── code-inspector/
│   ├── templates/
│   ├── calibration/
│   ├── manifest/
│   └── integrations/
│       └── fieldlens/
│
├── core/
│   ├── dataset/
│   ├── codes/
│   ├── layout/
│   ├── units/
│   ├── validation/
│   └── storage/
```

---

## 18. Shared data model

All features should operate on the same normalized dataset.

```ts
type StudioRecord = {
  id: string;
  values: Record<string, string>;
  warnings: DataWarning[];
};
```

This enables a continuous workflow:

```text
Import
  ↓
Clean
  ↓
Generate IDs
  ↓
Normalize serials
  ↓
Design labels
  ↓
Export PDF
```

---

## 19. Local persistence

Use `localStorage` for:

- theme
- unit preference
- active printer profile

Use `IndexedDB` for:

- saved templates
- saved printer profiles
- optional user-approved workspaces

Do not automatically retain imported spreadsheets.

---

## 20. Testing additions

### Asset ID Generator
- sequence generation
- zero padding
- duplicate handling
- token interpolation
- blank-only generation

### Data Health
- duplicate detection
- whitespace normalization
- empty rows
- missing identifiers
- reversible fixes

### Payload Builder
- interpolation
- missing placeholders
- URL validation
- custom URI validation

### Cable Labels
- mirrored layout
- long endpoint names
- narrow dimensions

### Calibration
- positive/negative X offsets
- positive/negative Y offsets
- reset behavior

### Manifest
For every generated label:

```text
PDF position == manifest position
```

---

## 21. Portfolio value

| Feature | Portfolio signal |
|---|---|
| Asset ID Generator | Rules engine and data transformation |
| Data Health | Validation and data-quality engineering |
| Templates | Portable configuration design |
| Payload Builder | Dynamic templating |
| Location Labels | Domain expansion |
| Cable Labels | Specialized layout/UI |
| Calibration | Real-world printing constraints |
| Code Inspector | Parsing and validation |
| Serial Tools | Pattern processing |
| Manifest Generator | Reproducible data output |
| FieldLens Export | Cross-project system design |

---

## 22. Immediate implementation priority

After the original MVP:

### 1. Asset ID Generator
Lets AssetTag Studio create identities instead of only printing existing ones.

### 2. Data Health
Makes imperfect real-world spreadsheet input practical.

### 3. Template Save / Export
Creates repeat-use value without accounts.

### 4. QR Payload Builder
Makes generated codes useful beyond plain identifiers.

Together these change the product from:

> "Upload a clean spreadsheet and print labels."

to:

> **"Bring imperfect asset data, clean it, assign consistent identities, encode those identities, and produce reusable physical labels."**

---

## 23. Product boundary

Even after expansion, AssetTag Studio should not become:

- an inventory database
- ERP software
- an asset-tracking SaaS
- a warehouse management system
- a CMMS
- a replacement for FieldLens

AssetTag Studio should remain focused on:

> **Asset identity preparation and physical labeling.**

FieldLens should handle:

> **Operational inspection and field workflows.**

---

## 24. Long-term project identity

The expanded product can be described as:

> **AssetTag Studio is a privacy-first browser workspace for preparing asset data, generating structured identifiers, designing QR and barcode labels, validating encoded data, and producing print-ready asset identity packages.**

Long-term workflow:

```text
Spreadsheet
     ↓
Data Health
     ↓
Asset ID Generator
     ↓
Serial Normalization
     ↓
QR Payload Builder
     ↓
Label Template
     ↓
Printer Calibration
     ↓
PDF Labels
     ↓
Manifest
     ↓
FieldLens
```

This is broad enough to justify the **Studio** name while remaining a focused, lightweight web product.
