#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-run
/**
 * Comprehensive Test Runner for ZtoApi
 * Runs all types of tests: unit, integration, linting, formatting, type checking
 */

const args = Deno.args;

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  output?: string;
  error?: string;
}

class TestRunner {
  private results: TestResult[] = [];
  private verbose = false;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  private log(message: string, color = COLORS.reset) {
    console.log(`${color}${message}${COLORS.reset}`);
  }

  private async runCommand(name: string, cmd: string[], cwd?: string): Promise<TestResult> {
    const start = Date.now();
    this.log(`\n${COLORS.blue}▶ Running ${name}...${COLORS.reset}`);

    try {
      const process = new Deno.Command(cmd[0], {
        args: cmd.slice(1),
        cwd: cwd || Deno.cwd(),
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout, stderr } = await process.output();
      const duration = Date.now() - start;
      const output = new TextDecoder().decode(stdout);
      const error = new TextDecoder().decode(stderr);

      const success = code === 0;
      const result: TestResult = { name, success, duration, output, error };

      if (success) {
        this.log(`  ✅ ${name} passed (${duration}ms)`, COLORS.green);
      } else {
        this.log(`  ❌ ${name} failed (${duration}ms)`, COLORS.red);
        if (this.verbose || !success) {
          if (error) this.log(`     Error: ${error}`, COLORS.red);
          if (output) this.log(`     Output: ${output}`, COLORS.yellow);
        }
      }

      this.results.push(result);
      return result;
    } catch (err) {
      const duration = Date.now() - start;
      const result: TestResult = {
        name,
        success: false,
        duration,
        error: err.message,
      };
      this.log(`  ❌ ${name} failed (${duration}ms) - ${err.message}`, COLORS.red);
      this.results.push(result);
      return result;
    }
  }

  async runTypeCheck(): Promise<TestResult> {
    return await this.runCommand("Type Check", [Deno.execPath(), "check", "main.ts"]);
  }

  async runLint(): Promise<TestResult> {
    return await this.runCommand("Lint", [Deno.execPath(), "lint"]);
  }

  async runFormat(): Promise<TestResult> {
    return await this.runCommand("Format Check", [Deno.execPath(), "fmt", "--check"]);
  }

  async runUnitTests(): Promise<TestResult> {
    return await this.runCommand("Unit Tests", [
      Deno.execPath(),
      "test",
      "--allow-net",
      "--allow-env",
      "--allow-read",
      "tests/",
    ]);
  }

  async runIntegrationTests(): Promise<TestResult> {
    // Start server in background for integration tests
    this.log(`\n${COLORS.cyan}🚀 Starting server for integration tests...${COLORS.reset}`);

    const serverProcess = new Deno.Command(Deno.execPath(), {
      args: ["run", "--allow-net", "--allow-env", "--allow-read", "main.ts"],
      env: { "PORT": "9091", "DEBUG_MODE": "false" },
      stdout: "piped",
      stderr: "piped",
    });

    const server = serverProcess.spawn();

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 3000));

    try {
      const result = await this.runCommand("Integration Tests", [
        Deno.execPath(),
        "test",
        "--allow-net",
        "--allow-env",
        "--allow-read",
        "tests/integration_test.ts",
      ]);

      // Kill server
      server.kill();
      return result;
    } catch (err) {
      server.kill();
      throw err;
    }
  }

  async runServerSmokeTest(): Promise<TestResult> {
    this.log(`\n${COLORS.cyan}🔥 Running server smoke test...${COLORS.reset}`);

    const serverProcess = new Deno.Command(Deno.execPath(), {
      args: ["run", "--allow-net", "--allow-env", "--allow-read", "main.ts"],
      env: { "PORT": "9092", "DEBUG_MODE": "false" },
      stdout: "piped",
      stderr: "piped",
    });

    const server = serverProcess.spawn();

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      // Test models endpoint
      const modelsResponse = await fetch("http://localhost:9092/v1/models");
      const modelsOk = modelsResponse.status === 200;

      // Test completion endpoint
      const completionResponse = await fetch("http://localhost:9092/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "GLM-4.5",
          messages: [{ role: "user", content: "test" }],
          stream: false,
        }),
      });
      const completionOk = completionResponse.status === 200;

      server.kill();

      const success = modelsOk && completionOk;
      const result: TestResult = {
        name: "Server Smoke Test",
        success,
        duration: 2000,
        output: `Models: ${modelsOk ? "✅" : "❌"}, Completion: ${completionOk ? "✅" : "❌"}`,
      };

      if (success) {
        this.log(`  ✅ Server Smoke Test passed`, COLORS.green);
      } else {
        this.log(`  ❌ Server Smoke Test failed`, COLORS.red);
        this.log(`     ${result.output}`, COLORS.yellow);
      }

      this.results.push(result);
      return result;
    } catch (err) {
      server.kill();
      const result: TestResult = {
        name: "Server Smoke Test",
        success: false,
        duration: 2000,
        error: err.message,
      };
      this.log(`  ❌ Server Smoke Test failed - ${err.message}`, COLORS.red);
      this.results.push(result);
      return result;
    }
  }

  printSummary() {
    const total = this.results.length;
    const passed = this.results.filter((r) => r.success).length;
    const failed = total - passed;
    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);

    this.log(
      `\n${COLORS.bold}═══════════════════════════════════════════════════════════════════════════════${COLORS.reset}`,
    );
    this.log(`${COLORS.bold}                                TEST SUMMARY${COLORS.reset}`);
    this.log(
      `${COLORS.bold}═══════════════════════════════════════════════════════════════════════════════${COLORS.reset}`,
    );

    this.log(`\n📊 Results:`);
    this.log(`   Total Tests: ${total}`);
    this.log(`   Passed: ${COLORS.green}${passed}${COLORS.reset}`);
    this.log(`   Failed: ${failed > 0 ? COLORS.red : COLORS.green}${failed}${COLORS.reset}`);
    this.log(`   Duration: ${totalTime}ms`);

    this.log(`\n📋 Test Details:`);
    for (const result of this.results) {
      const status = result.success ? `${COLORS.green}✅ PASS${COLORS.reset}` : `${COLORS.red}❌ FAIL${COLORS.reset}`;
      this.log(`   ${status} ${result.name} (${result.duration}ms)`);
    }

    if (failed > 0) {
      this.log(`\n${COLORS.red}❌ Some tests failed. See details above.${COLORS.reset}`);
      Deno.exit(1);
    } else {
      this.log(`\n${COLORS.green}🎉 All tests passed!${COLORS.reset}`);
    }
  }
}

// Simple argument parser
function hasArg(arg: string): boolean {
  return args.includes(arg) || args.includes(`--${arg}`);
}

function getArgValue(arg: string): string | undefined {
  const index = args.findIndex((a) => a === `--${arg}` || a === `-${arg[0]}`);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : undefined;
}

// Main execution
if (import.meta.main) {
  const verbose = hasArg("verbose") || hasArg("v");
  const help = hasArg("help") || hasArg("h");
  const quick = hasArg("quick") || hasArg("q");
  const integrationOnly = hasArg("integration-only");
  const smokeOnly = hasArg("smoke-only");
  const filter = getArgValue("filter") || getArgValue("f");

  if (help) {
    console.log(`
ZtoApi Test Runner

Usage: deno run tests.ts [options]

Options:
  -v, --verbose         Show detailed output
  -q, --quick          Skip integration tests (faster)
  --integration-only   Run only integration tests
  --smoke-only         Run only smoke tests
  -f, --filter <name>  Run only tests matching filter
  -h, --help           Show this help

Examples:
  deno run tests.ts                    # Run all tests
  deno run tests.ts --quick            # Skip integration tests
  deno run tests.ts --verbose          # Show detailed output
  deno run tests.ts --filter "lint"    # Run only lint tests
  deno run tests.ts --smoke-only       # Run only smoke tests
`);
    Deno.exit(0);
  }

  const runner = new TestRunner(verbose);

  console.log(`${COLORS.bold}${COLORS.cyan}🧪 ZtoApi Test Runner${COLORS.reset}`);
  console.log(`${COLORS.cyan}Running comprehensive test suite...${COLORS.reset}`);

  try {
    if (smokeOnly) {
      await runner.runServerSmokeTest();
    } else if (integrationOnly) {
      await runner.runIntegrationTests();
    } else {
      // Run all tests based on filter and options
      const filterLower = filter?.toLowerCase();

      if (!filterLower || "type".includes(filterLower)) {
        await runner.runTypeCheck();
      }

      if (!filterLower || "lint".includes(filterLower)) {
        await runner.runLint();
      }

      if (!filterLower || "format".includes(filterLower)) {
        await runner.runFormat();
      }

      if (!filterLower || "unit".includes(filterLower)) {
        await runner.runUnitTests();
      }

      if (!quick && (!filterLower || "integration".includes(filterLower))) {
        await runner.runIntegrationTests();
      }

      if (!filterLower || "smoke".includes(filterLower)) {
        await runner.runServerSmokeTest();
      }
    }

    runner.printSummary();
  } catch (error) {
    console.error(`${COLORS.red}Fatal error: ${error.message}${COLORS.reset}`);
    Deno.exit(1);
  }
}
