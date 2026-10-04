# ADR 0005: PDF as the print artifact

**Status:** Accepted

## Decision

Use the same rendered label image in the workspace preview and in a PDF laid out at physical page and label dimensions. Treat the PDF as the print deliverable and advise printing at actual size.

## Context and consequences

The preview and output need to agree on wrapping, codes, and spacing. A shared renderer and millimeter layout reduce divergence. The PDF labels are raster images rather than searchable text, and physical accuracy depends on the printer's actual-size setting and hardware.
