# Schneller Verbindungstest gegen die Atlassian/Jira-REST-API.
# Zugangsdaten NICHT hartcodieren – aus Umgebungsvariablen lesen:
#   $env:ATLASSIAN_EMAIL  = "vorname.nachname@rewe-group.com"
#   $env:ATLASSIAN_TOKEN  = "<API-Token aus id.atlassian.com>"
#   $env:ATLASSIAN_DOMAIN = "rewe.atlassian.net"   # optional, Default unten

if (-not $env:ATLASSIAN_EMAIL -or -not $env:ATLASSIAN_TOKEN) {
  Write-Error "Bitte `$env:ATLASSIAN_EMAIL und `$env:ATLASSIAN_TOKEN setzen."
  exit 1
}

$domain = if ($env:ATLASSIAN_DOMAIN) { $env:ATLASSIAN_DOMAIN } else { "rewe.atlassian.net" }
$pair = "$($env:ATLASSIAN_EMAIL):$($env:ATLASSIAN_TOKEN)"
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($pair))
curl.exe -s -o NUL -w "%{http_code}`n" -H "Authorization: Basic $b64" -H "Accept: application/json" "https://$domain/rest/api/3/myself"
