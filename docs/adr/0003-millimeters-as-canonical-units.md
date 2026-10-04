# ADR 0003: Millimeters as canonical units

**Status:** Accepted

## Decision

Store and calculate label, page, margin, and gap dimensions in millimeters. Convert to inches only at the interface boundary when the user selects inches.

## Context and consequences

Physical label dimensions must remain stable from editing through print output. One canonical unit avoids separate layout paths and keeps preview and PDF calculations consistent. The UI can still present either millimeters or inches.
