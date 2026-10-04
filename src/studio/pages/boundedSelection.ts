import type { Dataset } from '../../types';

export type BoundedSelection = {
  selectedCount: number;
  startPosition: number;
  previewCount: number;
  selectedIds: ReadonlySet<string>;
};

/** Selects a bounded contiguous batch from the current selection in stable dataset order. */
export function selectBoundedRows(
  dataset: Dataset,
  selectedIds: ReadonlySet<string>,
  startPosition: number,
  previewCount: number,
  maxPreviewCount: number,
): BoundedSelection {
  if (!Number.isInteger(maxPreviewCount) || maxPreviewCount < 1) throw new Error('Preview limit must be a positive integer.');
  const selected = dataset.records.filter(record => selectedIds.has(record.id));
  if (selected.length === 0) throw new Error('Select at least one row to preview.');
  if (!Number.isInteger(startPosition) || startPosition < 1 || startPosition > selected.length) {
    throw new Error(`Start position must be from 1 to ${selected.length}.`);
  }
  const remaining = selected.length - startPosition + 1;
  if (!Number.isInteger(previewCount) || previewCount < 1 || previewCount > Math.min(maxPreviewCount, remaining)) {
    throw new Error(`Preview count must be from 1 to ${Math.min(maxPreviewCount, remaining)}.`);
  }
  const batch = selected.slice(startPosition - 1, startPosition - 1 + previewCount);
  return { selectedCount: selected.length, startPosition, previewCount: batch.length, selectedIds: new Set(batch.map(record => record.id)) };
}
