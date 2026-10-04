import { groupResults } from '../results.ts';

import type {
  BenchmarkNote,
  BenchmarkSnapshot,
  BenchResult,
  LibraryInfo,
  LibraryName,
} from '../types.ts';

export interface CaseComparison {
  operation: string;
  payloadBytes: number;
  results: BenchResult[];
  subject: BenchResult | undefined;
  fastest: BenchResult | undefined;
  fastestCompetitor: BenchResult | undefined;
  lead: number | null;
}

export interface LibraryStanding {
  library: LibraryInfo;
  wins: number;
  relativeThroughput: number | null;
  relativeCpu: number | null;
  relativeMemory: number | null;
}

export interface BenchmarkAnalysis {
  subjectLibrary: LibraryName;
  cases: CaseComparison[];
  standings: LibraryStanding[];
  subjectWins: number;
  averageLead: number | null;
  peakLead: number | null;
  notes: BenchmarkNote[];
}

function geometricMean(values: number[]): number | null {
  return values.length === 0
    ? null
    : Math.exp(
        values.reduce((total, value) => total + Math.log(value), 0) /
          values.length,
      );
}

function fastestOf(results: BenchResult[]): BenchResult | undefined {
  return results.reduce<BenchResult | undefined>(
    (best, result) =>
      (result.unitsPerSecond ?? 0) > (best?.unitsPerSecond ?? 0)
        ? result
        : best,
    undefined,
  );
}

function compareCase(
  group: BenchResult[],
  libraries: LibraryInfo[],
  subjectLibrary: LibraryName,
): CaseComparison {
  const results = libraries.flatMap(
    (library) => group.find((result) => result.library === library.name) ?? [],
  );
  const subject = results.find((result) => result.library === subjectLibrary);
  const fastestCompetitor = fastestOf(
    results.filter((result) => result !== subject),
  );

  return {
    operation: group[0].operation,
    payloadBytes: group[0].payloadBytes,
    results,
    subject,
    fastest: fastestOf(results),
    fastestCompetitor,
    lead:
      subject?.unitsPerSecond && fastestCompetitor?.unitsPerSecond
        ? subject.unitsPerSecond / fastestCompetitor.unitsPerSecond
        : null,
  };
}

export function analyze(
  snapshot: BenchmarkSnapshot,
  subjectLibrary: LibraryName = 'solidis',
): BenchmarkAnalysis {
  const cases = groupResults(snapshot.results)
    .map((group) => compareCase(group, snapshot.libraries, subjectLibrary))
    .sort((left, right) => (right.lead ?? 0) - (left.lead ?? 0));
  const ratioTo = (
    library: LibraryName,
    read: (result: BenchResult) => number | null | undefined,
  ) =>
    geometricMean(
      cases.flatMap((comparison) => {
        const result = comparison.results.find(
          (candidate) => candidate.library === library,
        );
        const value = result && read(result);
        const reference = comparison.subject && read(comparison.subject);

        return value && reference ? [value / reference] : [];
      }),
    );
  const standings = snapshot.libraries
    .map((library) => ({
      library,
      wins: cases.filter(
        (comparison) => comparison.fastest?.library === library.name,
      ).length,
      relativeThroughput: ratioTo(
        library.name,
        (result) => result.unitsPerSecond,
      ),
      relativeCpu: ratioTo(
        library.name,
        (result) => result.cpuMicrosecondsPerUnit,
      ),
      relativeMemory: ratioTo(library.name, (result) => result.peakMemoryBytes),
    }))
    .sort(
      (left, right) =>
        (right.relativeThroughput ?? 0) - (left.relativeThroughput ?? 0),
    );
  const leads = cases.flatMap((comparison) => comparison.lead ?? []);

  return {
    subjectLibrary,
    cases,
    standings,
    subjectWins:
      standings.find((standing) => standing.library.name === subjectLibrary)
        ?.wins ?? 0,
    averageLead: geometricMean(leads),
    peakLead: leads.length > 0 ? Math.max(...leads) : null,
    notes: [
      ...new Map(
        cases.flatMap((comparison) =>
          comparison.results.flatMap((result) =>
            result.nonComparableReason
              ? [
                  [
                    JSON.stringify(result.nonComparableReason),
                    result.nonComparableReason,
                  ] as const,
                ]
              : [],
          ),
        ),
      ).values(),
    ],
  };
}

export function findNoteNumber(
  analysis: BenchmarkAnalysis,
  note: BenchmarkNote | undefined,
): number {
  const key = JSON.stringify(note);

  return note
    ? analysis.notes.findIndex((known) => JSON.stringify(known) === key) + 1
    : 0;
}
