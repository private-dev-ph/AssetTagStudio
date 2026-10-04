# Import format

Asset Tag Studio accepts comma-separated CSV files and Excel `.xlsx` or `.xls` workbooks. CSV uses the first non-empty row as the header. Excel imports one worksheet at a time, after the user selects it. Blank rows are skipped.

Every header must have a non-empty, unique name. Names are trimmed, and values remain text so identifiers such as `00123` keep their leading zeroes. Empty data columns are accepted with a warning. Extra populated cells beyond the declared headers are rejected. Header names such as `__proto__` are treated as ordinary fields.

Imports are bounded to 10 MiB, 20,000 data rows, 100 columns, and 10,000 characters per cell. Before an XLSX workbook is opened, its ZIP directory is checked for valid local and central headers and bounded to 2,048 entries, 16 MiB per expanded member, 64 MiB total expanded data, and a 1,000:1 expansion ratio. ZIP64, encrypted, multi-disk, unsupported-compression, data-descriptor, and archive-comment formats are rejected. If an Excel tool produces one of these formats, resave the workbook as a standard `.xlsx` file and retry. The ZIP checks bound declared expanded sizes and structural allocations; the 20-second worker limit also bounds parser runtime, though it cannot guarantee a strict CPU budget for every malformed compressed stream. Excel worksheet ranges are checked before conversion; an oversized declared range is rejected even if its cells appear blank. Formula expressions are never evaluated. Excel imports use stored cell values, so a formula with no stored result imports as an empty cell.

After import, choose an identifier column and review its diagnostics. Missing values and duplicate values are reported with row numbers. Identifiers are compared after trimming surrounding whitespace.

Malformed CSV quoting, duplicate or empty headers, unsupported cell values, oversized cells, excessive rows or columns, and rows with populated values beyond the header produce readable import errors. Data stays in memory for the current session.
