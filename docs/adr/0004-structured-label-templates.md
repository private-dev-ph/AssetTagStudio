# ADR 0004: Structured label templates

**Status:** Accepted

## Decision

Represent a label as a structured template: dimensions, code settings, ordered visible fields, and text styling. Do not add arbitrary drag-to-position editing to this workflow.

## Context and consequences

Inventory labels need repeatable layouts across many records. Structured fields make sizing, validation, and shared rendering predictable while supporting source selection, ordering, prefixes, visibility, font size, weight, and alignment. The editor offers less free-form placement than a general design canvas.
