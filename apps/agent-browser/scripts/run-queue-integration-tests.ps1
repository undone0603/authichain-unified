param(
    [string[]]$Backend = @("redis", "postgres", "nats", "sqs"),
    [switch]$FailFast
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$cliDir = Join-Path $repoRoot "cli"

$tests = @{
    "redis" = @{
        Name = "integration_redis_backpressure_terminal_fail"
        Env = @("AGENT_BROWSER_REDIS_URL")
    }
    "postgres" = @{
        Name = "integration_postgres_backpressure_terminal_fail"
        Env = @("AGENT_BROWSER_PG_QUEUE_DSN")
    }
    "nats" = @{
        Name = "integration_nats_backpressure_terminal_fail"
        Env = @("AGENT_BROWSER_NATS_URL")
    }
    "sqs" = @{
        Name = "integration_sqs_backpressure_terminal_fail"
        Env = @("AGENT_BROWSER_SQS_QUEUE_URL", "AGENT_BROWSER_SQS_DLQ_URL")
    }
}

$selected = @()
foreach ($item in $Backend) {
    foreach ($part in ($item -split ',')) {
        $key = $part.Trim().ToLowerInvariant()
        if ([string]::IsNullOrWhiteSpace($key)) {
            continue
        }
        if (-not $tests.ContainsKey($key)) {
            throw "Unknown backend '$part'. Expected one of: redis, postgres, nats, sqs"
        }
        if ($selected -notcontains $key) {
            $selected += $key
        }
    }
}

$ran = 0
$failed = @()
foreach ($backend in $selected) {
    $config = $tests[$backend]
    $missing = @()
    foreach ($envName in $config.Env) {
        $value = [Environment]::GetEnvironmentVariable($envName)
        if ([string]::IsNullOrWhiteSpace($value)) {
            $missing += $envName
        }
    }

    if ($missing.Count -gt 0) {
        Write-Host "Skipping $backend integration test; missing env: $($missing -join ', ')"
        continue
    }

    Write-Host "Running $backend integration test: $($config.Name)"
    Push-Location $cliDir
    try {
        cargo test $config.Name -- --ignored --test-threads=1
        if ($LASTEXITCODE -ne 0) {
            $failed += $backend
            if ($FailFast) {
                exit $LASTEXITCODE
            }
        }
    }
    finally {
        Pop-Location
    }

    $ran += 1
}

if ($ran -eq 0) {
    Write-Host "No queue integration tests ran. Set backend env vars first."
}

if ($failed.Count -gt 0) {
    Write-Host "Queue integration test failures: $($failed -join ', ')"
    exit 1
}
