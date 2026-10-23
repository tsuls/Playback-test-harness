// A normal import (not `import type`): enums exist at runtime, and this file
// uses their members as values, e.g. AttemptStatus.Passed.
import { AttemptStatus, RunOutcome } from './types';
import type { FlakeSummary, TestRun } from './types';

/**
 * How one run ended, given its attempts in order:
 * - 'pass'    the first attempt passed
 * - 'flaky'   an earlier attempt did not pass, but a later one did
 * - 'fail'    no attempt passed
 * - 'skipped' every attempt was skipped
 */
export function classifyRun(attempts: readonly AttemptStatus[]): RunOutcome {
  let countPasses = 0;
  let countSkips = 0;

  for(let i = 0; i < attempts.length; i++){
    // Is this attempt a pass?
    if(attempts[i] === AttemptStatus.Passed){
      // it is a pass.
      //first element check
      if(i === 0){
        //if the first attempt passed, then return
        return RunOutcome.Pass;
      }
      else{
        // otherwise, mark a pass;
        countPasses++;
      }
    }

    // Then, skips
    if(attempts[i] === AttemptStatus.Skipped){
      countSkips++;
    }
  }

  // If every attempt is a skip
  if(countSkips === attempts.length){
    return RunOutcome.Skipped;
  }

  // if no attempt passed, it's a fail. Failed, timedOut and interrupted all
  // count as "did not pass", so there is no need to count them separately.
  if(countPasses === 0){
    return RunOutcome.Fail;
  }

  //Otherwise, a later attempt passed after an earlier one did not: it's flaky.
  return RunOutcome.Flaky;
}

/**
 * Groups runs by `title` and counts outcomes. Skipped runs are left out of
 * every count, including `runs`. Output is sorted by title.
 */
export function summarizeFlakes(runs: readonly TestRun[]): FlakeSummary[] {
  // We need a map, to access each FlakeSummary by title
  const flakeSummaryMap = new Map<string, FlakeSummary>();

  //now, for each run
  for(const run of runs){
    // get the existing summary to update in the map
    let summary = flakeSummaryMap.get(run.title);

    //if its not in the map, its a new entry and we should create it.
    // This happens before the skip check so a test whose runs were all
    // skipped still shows up in the report, with every count at 0.
    if(!summary){
      summary = {
        title: run.title,
        runs: 0,
        passes: 0,
        failures: 0,
        flaky: 0,
        flakeRate: 0
      };
      //add to the map
      flakeSummaryMap.set(run.title, summary);
    }

    //obtain its RunOutcome
    const outcome = classifyRun(run.attempts);

    //skip if Skipped: it is not counted
    if(outcome === RunOutcome.Skipped){
      continue;
    }

    // now update the counters by reference
    summary.runs += 1;

    if(outcome === RunOutcome.Pass){
      summary.passes += 1;
    }
    else if (outcome === RunOutcome.Fail){
      summary.failures += 1;
    }
    else if (outcome === RunOutcome.Flaky){
      summary.flaky += 1;
    }

    // recalculate flake rate (flaky / runs) don't divide by zero. zero runs is zero flakes.
    summary.flakeRate = summary.runs > 0 ? summary.flaky / summary.runs : 0;
  }

  // now return the final summary array, sorted by title.
  // .values() is an iterator, so spread it into an array first.
  return [...flakeSummaryMap.values()].sort((a, b) => a.title.localeCompare(b.title));
}
