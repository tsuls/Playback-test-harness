// Jenkins version of .github/workflows/ci.yml: the same steps on the same two
// platforms, in Jenkins' declarative pipeline syntax (Groovy). Jenkins reads
// this file from the repo when a "Multibranch Pipeline" job points at it.
//
// Requires the Docker Pipeline plugin and Docker on a Linux agent, plus an agent
// labelled `windows` with Node 22, Git and Microsoft Edge installed.

pipeline {
  // No pipeline-wide agent: each platform stage picks its own machine.
  agent none

  options {
    timeout(time: 30, unit: 'MINUTES')
  }

  environment {
    // Same switch GitHub Actions sets; playwright.config.ts reads it.
    CI = 'true'
  }

  stages {
    stage('Platforms') {
      // Both platforms run at the same time, like the matrix in ci.yml.
      // failFast false: one platform failing doesn't abort the other.
      failFast false
      parallel {
        stage('linux-chromium') {
          // Microsoft's Playwright image already contains Node, Chromium and
          // Chromium's Linux libraries. The tag must match the @playwright/test
          // version in package-lock.json.
          agent {
            docker {
              image 'mcr.microsoft.com/playwright:v1.64.1-noble'
              // Playwright's docs recommend this for Chromium in Docker: the
              // default shared-memory size is too small and can crash the browser.
              args '--ipc=host'
            }
          }
          environment {
            // Jenkins runs the container as its own user, which can't write to
            // the image's home directory. Keep npm's cache inside the workspace.
            npm_config_cache = "${WORKSPACE}/.npm"
          }
          stages {
            stage('Install') {
              steps { sh 'npm ci' }
            }
            stage('Type check') {
              steps { sh 'npx tsc' }
            }
            stage('Test') {
              // A flaky test (passes on retry) does not fail the build; a test
              // that fails both attempts does. Same rule as GitHub Actions.
              // The experiment arms run in their own stage, with more runs.
              steps { sh 'npx playwright test --repeat-each=3 --grep-invert @experiment' }
            }
          }
          // `post { always }` runs whether the stages passed or failed, like
          // `if: !cancelled()` in the GitHub workflow. Each report runs
          // separately, so one failing script can't hide the other's table.
          // Jenkins has no job-summary page: the tables go to the build log.
          post {
            always {
              sh 'npx tsx scripts/flake-report.ts || echo "flake report skipped"'
              sh 'npx tsx scripts/metrics-report.ts || echo "metrics report skipped"'
              junit allowEmptyResults: true, testResults: 'results/junit.xml'
              sh 'node scripts/archive-results.mjs linux-chromium'
              archiveArtifacts allowEmptyArchive: true, artifacts: 'archive/linux-chromium/**'
            }
          }
        }

        stage('windows-edge') {
          // Runs directly on the Windows agent (no Docker), which the controller
          // connects to over SSH. playwright.config.ts sees win32 and picks the
          // `edge` project, so no browser download is needed.
          agent { label 'windows' }
          stages {
            stage('Install') {
              // `bat` runs a Windows cmd command, the Windows twin of `sh`.
              steps { bat 'npm ci' }
            }
            stage('Type check') {
              steps { bat 'npx tsc' }
            }
            stage('Test') {
              steps { bat 'npx playwright test --repeat-each=3 --grep-invert @experiment' }
            }
          }
          post {
            always {
              // npx is a .cmd script on Windows; without `call`, cmd hands
              // control to it and never comes back to run `|| echo`.
              bat 'call npx tsx scripts/flake-report.ts || echo flake report skipped'
              bat 'call npx tsx scripts/metrics-report.ts || echo metrics report skipped'
              junit allowEmptyResults: true, testResults: 'results/junit.xml'
              bat 'node scripts/archive-results.mjs windows-edge'
              archiveArtifacts allowEmptyArchive: true, artifacts: 'archive/windows-edge/**'
            }
          }
        }

        // The A/B experiment, 10 runs per arm, so compareArms has enough samples
        // to call a verdict. Same as the `experiment` job in ci.yml. A stage
        // fails only if the guardrail fails (a playback error in either arm).
        stage('linux-chromium-experiment') {
          agent {
            docker {
              image 'mcr.microsoft.com/playwright:v1.64.1-noble'
              args '--ipc=host'
            }
          }
          environment {
            npm_config_cache = "${WORKSPACE}/.npm"
          }
          stages {
            stage('Install') {
              steps { sh 'npm ci' }
            }
            stage('Experiment') {
              steps { sh 'npx playwright test --grep @experiment --repeat-each=10' }
            }
          }
          post {
            always {
              sh 'npx tsx scripts/experiment-report.ts || echo "experiment report skipped"'
              sh 'node scripts/archive-results.mjs linux-chromium-experiment'
              archiveArtifacts allowEmptyArchive: true, artifacts: 'archive/linux-chromium-experiment/**'
            }
          }
        }

        // The Windows agent has one executor, so this stage waits for
        // windows-edge to finish and then runs on the same machine.
        stage('windows-edge-experiment') {
          agent { label 'windows' }
          stages {
            stage('Install') {
              steps { bat 'npm ci' }
            }
            stage('Experiment') {
              steps { bat 'npx playwright test --grep @experiment --repeat-each=10' }
            }
          }
          post {
            always {
              bat 'call npx tsx scripts/experiment-report.ts || echo experiment report skipped'
              bat 'node scripts/archive-results.mjs windows-edge-experiment'
              archiveArtifacts allowEmptyArchive: true, artifacts: 'archive/windows-edge-experiment/**'
            }
          }
        }
      }
    }
  }
}
