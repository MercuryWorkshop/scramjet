# cv: build tasks for this repository. `.\cv` prints help.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
	Write-Error "cv: node 22.18+ is required (https://nodejs.org)"
	exit 1
}
& node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=18)?0:1)'
if ($LASTEXITCODE -ne 0) {
	Write-Error "cv: node $(node -v) is too old, need 22.18+ (it runs TypeScript directly)"
	exit 1
}

& node --no-warnings=ExperimentalWarning packages/cv/main.ts @args
exit $LASTEXITCODE
