/** Marker written by Task Feature Library versions before automatic parents. */
export const LEGACY_PARENT_TASK_MARKER_CLASS =
  "task-feature-library-parent-marker";
export const LEGACY_PARENT_TASK_MARKER = `<span class="${LEGACY_PARENT_TASK_MARKER_CLASS}"></span>`;

/** Remove obsolete markers while preserving marker examples inside code spans. */
export function removeLegacyParentTaskMarkers(value: string): string {
  const markerIndices = findLegacyMarkerIndices(value);
  let result = value;

  for (const markerIndex of markerIndices.reverse()) {
    const before = result.slice(0, markerIndex).replace(/[\t ]+$/u, "");
    const rawAfter = result.slice(
      markerIndex + LEGACY_PARENT_TASK_MARKER.length,
    );

    if (/^[\t ]*$/u.test(rawAfter)) {
      // Trailing spaces can be a significant Markdown hard break.
      result = before + rawAfter;
      continue;
    }

    const after = rawAfter.replace(/^[\t ]+/u, "");
    result = before.length > 0 ? `${before} ${after}` : after;
  }

  return result;
}

function findLegacyMarkerIndices(value: string): number[] {
  const codeSpans = findInlineCodeSpans(value);
  const indices: number[] = [];
  let searchFrom = 0;

  while (searchFrom < value.length) {
    const markerIndex = value.indexOf(LEGACY_PARENT_TASK_MARKER, searchFrom);
    if (markerIndex === -1) {
      break;
    }

    if (
      !codeSpans.some(
        (range) => markerIndex >= range.from && markerIndex < range.to,
      )
    ) {
      indices.push(markerIndex);
    }
    searchFrom = markerIndex + LEGACY_PARENT_TASK_MARKER.length;
  }

  return indices;
}

function findInlineCodeSpans(
  value: string,
): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  let cursor = 0;

  while (cursor < value.length) {
    const opener = value.indexOf("`", cursor);
    if (opener === -1) {
      break;
    }

    const delimiterLength = backtickRunLength(value, opener);
    const closer = findMatchingBacktickRun(
      value,
      opener + delimiterLength,
      delimiterLength,
    );
    if (closer === -1) {
      ranges.push({ from: opener, to: value.length });
      break;
    }

    const to = closer + delimiterLength;
    ranges.push({ from: opener, to });
    cursor = to;
  }

  return ranges;
}

function findMatchingBacktickRun(
  value: string,
  start: number,
  delimiterLength: number,
): number {
  let cursor = start;
  while (cursor < value.length) {
    const candidate = value.indexOf("`", cursor);
    if (candidate === -1) {
      return -1;
    }

    const candidateLength = backtickRunLength(value, candidate);
    if (candidateLength === delimiterLength) {
      return candidate;
    }
    cursor = candidate + candidateLength;
  }

  return -1;
}

function backtickRunLength(value: string, start: number): number {
  let end = start;
  while (value[end] === "`") {
    end += 1;
  }
  return end - start;
}
