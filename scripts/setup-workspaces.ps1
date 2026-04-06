<#
Setup OpenWA workspaces directory (Windows PowerShell)
Usage (run as Administrator):
  .\setup-workspaces.ps1 -UserName 'adens' -GrantGroup 'Users'

This script creates the workspaces path (defaults to $env:USERPROFILE\.openwa\workspaces)
and grants full control to the specified user or group recursively using icacls.
#>
param(
  [string]$UserName = $env:USERNAME,
  [string]$GrantGroup = $null
)

$workspaces = $env:OPENWA_WORKSPACES_DIR
if (-not $workspaces) { $workspaces = Join-Path $env:USERPROFILE '.openwa\workspaces' }

Write-Host "Creating workspaces directory: $workspaces"
New-Item -ItemType Directory -Path $workspaces -Force | Out-Null

$grantTarget = if ($GrantGroup) { $GrantGroup } else { $UserName }

Write-Host "Granting full control to: $grantTarget"
# Grant full control to user/group, propagate to child objects
$icaclsCmd = "icacls `"$workspaces`" /grant `"$grantTarget`":(OI)(CI)F /T"
Write-Host $icaclsCmd
try {
  cmd.exe /c $icaclsCmd | ForEach-Object { Write-Host $_ }
  Write-Host "ACLs updated."
} catch {
  Write-Warning "icacls failed: $_"
}

Write-Host "Done. Ensure service/agent is run under a user or group that has access."