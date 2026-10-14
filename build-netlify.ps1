param(
  [switch]$Watch
)

$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
$siteDirectory = Join-Path $projectRoot "netlify-site"
$releaseDirectory = Join-Path $projectRoot "releases"
$assetFiles = @(
  "index.html",
  "styles.css",
  "script.js",
  "admin.html",
  "admin.css",
  "admin.js",
  "noticia.html",
  "article-format.js",
  "article.css",
  "article.js",
  "_headers"
)
$releasePattern = "^Pulso-Netlify-v(\d+)\.zip$"

function Get-CurrentContentHash {
  $entries = foreach ($fileName in ($assetFiles | Sort-Object)) {
    $filePath = Join-Path $projectRoot $fileName
    if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
      throw "Arquivo necessário para o site não encontrado: $fileName"
    }
    $fileHash = (Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash
    "$fileName`:$fileHash"
  }
  $manifestText = $entries -join "`n"
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($manifestText)
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    return ([BitConverter]::ToString($sha256.ComputeHash($bytes))).Replace("-", "")
  } finally {
    $sha256.Dispose()
  }
}

function Publish-NetlifyVersion {
  New-Item -ItemType Directory -Path $siteDirectory -Force | Out-Null
  New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null

  foreach ($fileName in $assetFiles) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $fileName) -Destination $siteDirectory -Force
  }
  $contentHash = Get-CurrentContentHash
  $existingReleases = @(Get-ChildItem -LiteralPath $releaseDirectory -Filter "Pulso-Netlify-v*.zip" -File |
    Where-Object { $_.Name -match $releasePattern } |
    Sort-Object { [int]($_.Name -replace $releasePattern, '$1') })
  $previousVersion = 0
  $previousHash = ""

  if ($existingReleases.Count -gt 0) {
    $latestRelease = $existingReleases[-1]
    $previousVersion = [int]($latestRelease.Name -replace $releasePattern, '$1')
    $hashPath = Join-Path $releaseDirectory ($latestRelease.Name + ".sha256")
    if (Test-Path -LiteralPath $hashPath) {
      $previousHash = (Get-Content -LiteralPath $hashPath -Raw).Trim()
    }
  }

  if ($previousHash -eq $contentHash) {
    Write-Output "Sem alterações no site. A versão v$previousVersion continua atual."
    return
  }

  $version = $previousVersion + 1
  $versionData = [ordered]@{
    version = "v$version"
    updatedAt = (Get-Date).ToUniversalTime().ToString("o")
  }
  $versionPath = Join-Path $siteDirectory "version.json"
  $versionJson = $versionData | ConvertTo-Json -Compress
  [System.IO.File]::WriteAllText($versionPath, $versionJson, (New-Object System.Text.UTF8Encoding($false)))

  $archiveName = "Pulso-Netlify-v$version.zip"
  $archivePath = Join-Path $releaseDirectory $archiveName
  $temporaryArchive = Join-Path $releaseDirectory (".$archiveName.tmp.zip")
  if (Test-Path -LiteralPath $temporaryArchive) {
    Remove-Item -LiteralPath $temporaryArchive -Force
  }
  Compress-Archive -Path (Join-Path $siteDirectory "*") -DestinationPath $temporaryArchive -CompressionLevel Optimal
  Move-Item -LiteralPath $temporaryArchive -Destination $archivePath -Force
  Set-Content -LiteralPath (Join-Path $releaseDirectory "$archiveName.sha256") -Value $contentHash -NoNewline -Encoding ASCII

  Write-Output "Criada a versão v${version}: $archivePath"
}

Publish-NetlifyVersion

if ($Watch) {
  $watcher = New-Object System.IO.FileSystemWatcher
  $watcher.Path = $projectRoot
  $watcher.Filter = "*"
  $watcher.IncludeSubdirectories = $false
  $watcher.NotifyFilter = [IO.NotifyFilters]::FileName -bor [IO.NotifyFilters]::LastWrite -bor [IO.NotifyFilters]::Size
  $watcher.EnableRaisingEvents = $true

  $sourceIds = @(
    "PulsoNetlifyChanged",
    "PulsoNetlifyCreated",
    "PulsoNetlifyDeleted",
    "PulsoNetlifyRenamed"
  )
  Register-ObjectEvent -InputObject $watcher -EventName Changed -SourceIdentifier $sourceIds[0] | Out-Null
  Register-ObjectEvent -InputObject $watcher -EventName Created -SourceIdentifier $sourceIds[1] | Out-Null
  Register-ObjectEvent -InputObject $watcher -EventName Deleted -SourceIdentifier $sourceIds[2] | Out-Null
  Register-ObjectEvent -InputObject $watcher -EventName Renamed -SourceIdentifier $sourceIds[3] | Out-Null
  Write-Output "Netlify watcher ativo. Alterações nos arquivos do site criarão um novo ZIP automaticamente."

  try {
    while ($true) {
      $event = Wait-Event -Timeout 1
      if (-not $event) { continue }
      $rebuild = $false

      do {
        $eventName = $event.SourceEventArgs.Name
        $oldName = $event.SourceEventArgs.OldName
        if (($assetFiles -contains $eventName) -or ($assetFiles -contains $oldName)) {
          $rebuild = $true
        }
        Remove-Event -EventIdentifier $event.EventIdentifier
        $event = Get-Event | Where-Object { $sourceIds -contains $_.SourceIdentifier } | Select-Object -First 1
      } while ($event)

      if ($rebuild) {
        Start-Sleep -Milliseconds 800
        try {
          Publish-NetlifyVersion
        } catch {
          Write-Error "Não foi possível gerar o ZIP atualizado: $_"
        }
      }
    }
  } finally {
    $watcher.EnableRaisingEvents = $false
    $watcher.Dispose()
    foreach ($sourceId in $sourceIds) {
      Unregister-Event -SourceIdentifier $sourceId -ErrorAction SilentlyContinue
    }
  }
}
