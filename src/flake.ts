import type { AttemptStatus, FlakeSummary, RunOutcome, TestRun } from './types';

/**
 * How one run ended, given its attempts in order:
 * - 'pass'    the first attempt passed
 * - 'flaky'   an earlier attempt did not pass, but a later one did
 * - 'fail'    no attempt passed
 * - 'skipped' every attempt was skipped
 */
export function classifyRun(attempts: readonly AttemptStatus[]): RunOutcome {
   let countPasses = 0;
   let countFails = 0;
   let countSkips = 0;
   
   for(int i = 0; i < attempts.length; i++){
      // Is this attempt a pass?
      if(attemps[i] == AttemptStatus.Pass){
        // it is a pass. 
        //first element check
        if(i == 0){
          //if the first attempt passed, then return
          return RunOutcome.Pass
        }
        else{
          // otherwise, mark a pass;
          countPasses++;
        }
      }

      // Next, we need to continue, if it is not a pass, what is it?
      if(attempts[i] == AttemptStatus.Failed || attempts[i] == AttemptStatus.TimedOut 
        || attempts[i] == AttemptStatus.Interrupted){
          // This is a fail. Count a fail
          countFails++;
      }

      // Then, skips
      if(attempts[i] == AttemptStatus.Skipped){
        countSkips++;
      }
    }

    // If every attempt is a skip
    if(countSkips == attempts.length){
      return RunOutcome.Skipped;
    }

    // if every attempt is a fail
    if(countFails == attempts.length){
      return RunOutcome.Fail;
    }

    // if every attempt is a pass (this wont happen)
    if(countPasses == attempts.length){
      return RunOutcome.Pass
    }

    //Otherwise, its flaky. 
    return RunOutcome.Flaky;
}

/**
 * Groups runs by `title` and counts outcomes. Skipped runs are left out of
 * every count, including `runs`. Output is sorted by title.
 */
export function summarizeFlakes(runs: readonly TestRun[]): FlakeSummary[] {
  // create a shallow copy
  let testRunCopy = [...runs];

  // We need a map, to access each FlakeSummary by title
  const flakeSummaryMap: Map<string, FlakeSummary>;

  //now, for each run
  for(run of runs){
    //obtain its RunOutcome
    let outcome = classifyRun(run);

    //skip if Skipped
    if(outcome != RunOutcome.Skipped){
      
      // get the existing summary to update in the map
      let summary = flakeSummaryMap.get(run.title);

      //if its not in the map, its a new entry and we should create it
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
        flakeSummaryMap.insert(summary);
      }

        // now update the counters by reference
        summary.runs += 1;

        if(outcome == RunOutcome.Pass){
          summary.passes += 1;
        }
        else if (outcome == RunOutcome.Fail){
          summary.failures += 1;
        }
        else if (outcome == RunOutcome.Flaky){
          summary.flaky += 1;
        }

        // recalculate flake rate (flaky / runs) don't divide by zero. zero runs is zero flakes.
        summary.flakeRate = summary.runs > 0 ? summary.flaky / summary.runs : 0;
    }


  }

  // now return the final summary array
  return flakeSummaryMap.values();
}
