// Jenkins version of .github/workflows/ci.yml: the same steps, in Jenkins'
// declarative pipeline syntax (Groovy). Jenkins reads this file from the repo
// when a "Pipeline from SCM" or "Multibranch Pipeline" job points at it.
//
// Requires the Docker Pipeline plugin, and Docker on the Jenkins agent.

pipeline {
  // Run every stage inside Microsoft's Playwright image, which already contains
  // Node, Chromium and Chromium's Linux libraries. The tag must match the
  // @playwright/test version in package-lock.json.
  agent {
    docker {
      image 'mcr.microsoft.com/playwright:v1.64.1-noble'
      // Playwright's docs recommend this for Chromium in Docker: the default
      // shared-memory size is too small and can crash the browser.
      args '--ipc=host'
    }
  }

  options {
    timeout(time: 20, unit: 'MINUTES')
  }

  environment {
    // Same switch GitHub Actions sets; playwright.config.ts reads it.
    CI = 'true'
    // Jenkins runs the container as its own user, which can't write to the
    // image's home directory. Keep npm's cache inside the workspace instead.
    npm_config_cache = "${WORKSPACE}/.npm"
  }

  stages {
    stage('Install') {
      steps {
        sh 'npm ci'
      }
    }
    stage('Type check') {
      steps {
        sh 'npx tsc'
      }
    }
    stage('Test') {
      steps {
        // Same rule as GitHub Actions: a flaky test (passes on retry) does not
        // fail the build; a test that fails both attempts does.
        sh 'npx playwright test --repeat-each=3'
      }
    }
  }

  // `post { always }` runs whether the stages passed or failed, like
  // `if: !cancelled()` in the GitHub workflow.
  post {
    always {
      // Each report runs separately, so one failing script can't hide the
      // other's table. Jenkins has no job-summary page: the tables go to the
      // build log, and the files are archived below.
      sh 'npx tsx scripts/flake-report.ts || echo "flake report skipped"'
      sh 'npx tsx scripts/metrics-report.ts || echo "metrics report skipped"'
      // Per-test results and trends on the build page.
      junit allowEmptyResults: true, testResults: 'results/junit.xml'
      archiveArtifacts allowEmptyArchive: true, artifacts: 'playwright-report/**, results/**'
    }
  }
}
