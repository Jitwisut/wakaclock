param([Parameter(Mandatory=$true)][string]$ExpectedBuildSha,[string]$Output="output/team-github-certification/windows-build.json")
$ErrorActionPreference="Stop"
$sha=(git rev-parse HEAD).Trim()
if ($sha -ne $ExpectedBuildSha) { throw "Build SHA differs from Mac certification manifest" }
if (git status --porcelain --untracked-files=no) { throw "Certification requires a clean source tree" }
Push-Location backend/api
try { cargo build -p wakaclock-cli --bin team-session-context; if ($LASTEXITCODE -ne 0) { throw "Context sidecar build failed" } } finally { Pop-Location }
$parent=Split-Path $Output -Parent
New-Item -ItemType Directory -Force $parent | Out-Null
@{schema_version=1;build_sha=$sha;os="windows";architecture=$env:PROCESSOR_ARCHITECTURE;rust_version=(rustc --version);captured_at=[DateTimeOffset]::UtcNow.ToString("o");certification_status="pending_user_sessions"} | ConvertTo-Json | Set-Content -Encoding utf8 $Output
Write-Output "Build metadata saved. This does not certify provider sessions or inline capture."
