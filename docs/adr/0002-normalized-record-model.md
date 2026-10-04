# ADR 0002: One normalized record model

**Status:** Accepted

## Decision

Normalize CSV rows and selected Excel worksheets into one dataset with generic column names and string-valued records.

## Context and consequences

Source files differ in format and need not use a prescribed schema. A shared model lets identifier checks, table controls, label templates, and export work the same way for either import path. Leading zeroes and other identifier text stay intact; users choose which column identifies an asset.
