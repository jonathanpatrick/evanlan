# Smoke test the server end-to-end.
# Usage (after `npm install` and `npm run build`):
#   $env:INGEST_TOKEN = "dev-token"; npm start          # in one terminal
#   .\scripts\smoke.ps1                                  # in another
param(
    [string]$BaseUrl = "http://localhost:8080",
    [string]$Token = $env:INGEST_TOKEN
)

if (-not $Token) { $Token = "dev-token" }

$headers = @{ "X-Ingest-Token" = $Token; "Content-Type" = "application/json" }

foreach ($f in @("samples/synthetic-match-v5.json", "samples/synthetic-match-v5-2.json")) {
    Write-Host "Ingesting $f"
    $body = Get-Content $f -Raw
    $resp = Invoke-RestMethod -Uri "$BaseUrl/games" -Method Post -Headers $headers -Body $body
    $resp | ConvertTo-Json -Depth 5
}

Write-Host "`n--- GET /api/players ---"
Invoke-RestMethod -Uri "$BaseUrl/api/players" | ConvertTo-Json -Depth 5

Write-Host "`n--- GET /api/champions ---"
Invoke-RestMethod -Uri "$BaseUrl/api/champions" | ConvertTo-Json -Depth 5

Write-Host "`n--- GET /api/players/Alice ---"
Invoke-RestMethod -Uri "$BaseUrl/api/players/Alice" | ConvertTo-Json -Depth 5
