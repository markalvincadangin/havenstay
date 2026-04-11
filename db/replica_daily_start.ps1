# HavenStay replica daily start helper
# Use this after restarting MySQL services to verify and optionally repair replication.
# Example:
#   powershell -ExecutionPolicy Bypass -File db/replica_daily_start.ps1 -AutoRepair

param(
    [string]$EnvFile = "db/replica_daily_start.env",
    [string]$MysqlExe = "mysql",
    [string]$MysqldumpExe = "mysqldump",
    [string]$MysqldExe = "C:/laragon/bin/mysql/mysql-8.4.3-winx64/bin/mysqld.exe",
    [string]$ReplicaDefaultsFile = "C:/laragon/bin/mysql/mysql-8.4.3-winx64/my-replica.ini",
    [string]$ReseedDatabases = "havenstay",
    [string]$ReseedDumpFile = "C:/laragon/tmp/havenstay_reseed.sql",
    [bool]$StartReplicaIfDown = $true,
    [int]$ReplicaStartWaitSeconds = 15,
    [string]$SourceHost = "127.0.0.1",
    [int]$SourcePort = 3306,
    [string]$ReplicaHost = "127.0.0.1",
    [int]$ReplicaPort = 3307,
    [string]$ReplicaAdminUser = "root",
    [SecureString]$ReplicaAdminPassword,
    [string]$ReplUser = "replica",
    [SecureString]$ReplPassword,
    [switch]$AutoReseedOn1236,
    [switch]$AutoRepair,
    [switch]$ForceChannelReset
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function To-BoolOrDefault {
    param(
        [string]$Value,
        [bool]$Default
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $Default
    }

    switch ($Value.Trim().ToLowerInvariant()) {
        "1" { return $true }
        "true" { return $true }
        "yes" { return $true }
        "on" { return $true }
        "0" { return $false }
        "false" { return $false }
        "no" { return $false }
        "off" { return $false }
        default { return $Default }
    }
}

function Load-EnvFile {
    param([string]$Path)

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return @{}
    }

    $resolvedPath = $Path
    if (-not [System.IO.Path]::IsPathRooted($resolvedPath)) {
        $cwdCandidate = Join-Path (Get-Location) $resolvedPath
        if (Test-Path $cwdCandidate) {
            $resolvedPath = $cwdCandidate
        }
        else {
            $scriptCandidate = Join-Path $PSScriptRoot $resolvedPath
            if (Test-Path $scriptCandidate) {
                $resolvedPath = $scriptCandidate
            }
            else {
                return @{}
            }
        }
    }
    elseif (-not (Test-Path $resolvedPath)) {
        return @{}
    }

    $map = @{}
    foreach ($rawLine in (Get-Content -Path $resolvedPath)) {
        $line = $rawLine.Trim()
        if ($line -eq "" -or $line.StartsWith("#")) {
            continue
        }

        $splitIndex = $line.IndexOf("=")
        if ($splitIndex -lt 1) {
            continue
        }

        $key = $line.Substring(0, $splitIndex).Trim()
        $value = $line.Substring($splitIndex + 1).Trim()

        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        $map[$key] = $value
    }

    return $map
}

function ConvertTo-PlainText {
    param([SecureString]$Secure)
    if (-not $Secure) { return "" }

    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

function Invoke-MySql {
    param(
        [string]$DbHost,
        [int]$Port,
        [string]$User,
        [string]$Password,
        [string]$Query,
        [bool]$SkipColumnNames = $true
    )

    $args = @(
        "--host=$DbHost",
        "--port=$Port",
        "--user=$User",
        "--protocol=TCP",
        "--batch",
        "--raw",
        "--connect-timeout=5"
    )

    if ($SkipColumnNames) {
        $args += "--skip-column-names"
    }

    if ($Password -ne "") {
        $args += "--password=$Password"
    }

    $args += "--execute=$Query"

    $stderrFile = [System.IO.Path]::GetTempFileName()

    try {
        $previousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            $stdOut = & $MysqlExe @args 2> $stderrFile
        }
        finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }

        $stdErr = Get-Content -Path $stderrFile -Raw -ErrorAction SilentlyContinue

        $output = @()
        if ($stdOut) { $output += ($stdOut | Out-String) }
        if ($stdErr) { $output += $stdErr }
        $output = ($output -join [Environment]::NewLine)

        $exitCode = $LASTEXITCODE
        if ($exitCode -eq 0 -and $output -match "(?m)^ERROR\s+[0-9]+") {
            $exitCode = 1
        }
    }
    finally {
        Remove-Item -Path $stderrFile -ErrorAction SilentlyContinue
    }

    return [pscustomobject]@{
        ExitCode = $exitCode
        Output = $output
    }
}

function Get-ReplicaStatusMap {
    param(
        [string]$DbHost,
        [int]$Port,
        [string]$User,
        [string]$Password,
        [switch]$AllowEmpty
    )

    $result = Invoke-MySql -DbHost $DbHost -Port $Port -User $User -Password $Password -Query "SHOW REPLICA STATUS" -SkipColumnNames $false
    if ($result.ExitCode -ne 0) {
        throw "Could not read replica status from ${DbHost}:${Port}. mysql exit code: $($result.ExitCode). Output: $($result.Output.Trim())"
    }

    $status = @{}
    $lines = ($result.Output -split "`r?`n")

    $headerLine = $null
    $dataLine = $null
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "Replica_IO_Running" -and $lines[$i].Contains("`t")) {
            $headerLine = $lines[$i]
            for ($j = $i + 1; $j -lt $lines.Count; $j++) {
                if (-not [string]::IsNullOrWhiteSpace($lines[$j])) {
                    $dataLine = $lines[$j]
                    break
                }
            }
            break
        }
    }

    if ($headerLine -and $dataLine) {
        $keys = $headerLine.Split("`t")
        $values = $dataLine.Split("`t")
        $count = [Math]::Min($keys.Count, $values.Count)
        for ($k = 0; $k -lt $count; $k++) {
            $status[$keys[$k].Trim()] = $values[$k].Trim()
        }
    }
    else {
        foreach ($line in $lines) {
            if ($line -match "^\\s*([^:]+):\\s*(.*)$") {
                $status[$matches[1].Trim()] = $matches[2].Trim()
            }
        }
    }

    if ($status.Count -eq 0 -and -not $AllowEmpty) {
        throw "SHOW REPLICA STATUS returned no data. Is replication configured on replica ${DbHost}:${Port}?"
    }

    return $status
}

function Print-Health {
    param([hashtable]$Status)

    Write-Host "Replica_IO_Running : $($Status['Replica_IO_Running'])"
    Write-Host "Replica_SQL_Running: $($Status['Replica_SQL_Running'])"
    Write-Host "Source_Log_File    : $($Status['Source_Log_File'])"
    Write-Host "Read_Source_Log_Pos: $($Status['Read_Source_Log_Pos'])"
    Write-Host "Last_IO_Error      : $($Status['Last_IO_Error'])"
    Write-Host "Last_SQL_Error     : $($Status['Last_SQL_Error'])"
}

function Test-PortOpen {
    param(
        [string]$TargetHost,
        [int]$Port,
        [int]$TimeoutMs = 1200
    )

    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect($TargetHost, $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) {
            return $false
        }

        $client.EndConnect($async)
        return $true
    }
    catch {
        return $false
    }
    finally {
        $client.Close()
    }
}

function Ensure-ReplicaRunning {
    param(
        [string]$TargetHost,
        [int]$Port,
        [bool]$AllowStart,
        [string]$MysqldPath,
        [string]$DefaultsFile,
        [int]$WaitSeconds
    )

    if (Test-PortOpen -TargetHost $TargetHost -Port $Port) {
        Write-Host "Replica port ${TargetHost}:${Port} is already listening."
        return
    }

    if (-not $AllowStart) {
        throw "Replica is down on ${TargetHost}:${Port}. Re-run with -StartReplicaIfDown `$true or start mysqld manually."
    }

    if (-not (Test-Path $MysqldPath)) {
        throw "mysqld executable not found at $MysqldPath"
    }

    if (-not (Test-Path $DefaultsFile)) {
        throw "Replica defaults file not found at $DefaultsFile"
    }

    Write-Host "Replica is down. Starting mysqld for replica..." -ForegroundColor Yellow
    Start-Process -FilePath $MysqldPath -ArgumentList "--defaults-file=$DefaultsFile", "--console" | Out-Null

    $deadline = (Get-Date).AddSeconds($WaitSeconds)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 500
        if (Test-PortOpen -TargetHost $TargetHost -Port $Port) {
            Write-Host "Replica started successfully on ${TargetHost}:${Port}."
            return
        }
    }

    throw "Replica did not start within ${WaitSeconds}s on ${TargetHost}:${Port}. Check replica error log and my-replica.ini."
}

function Invoke-MysqldumpToFile {
    param(
        [string]$DbHost,
        [int]$Port,
        [string]$User,
        [string]$Password,
        [string]$Databases,
        [string]$OutputFile
    )

    if (-not (Get-Command $MysqldumpExe -ErrorAction SilentlyContinue)) {
        throw "mysqldump not found. Install MySQL client tools or set MYSQLDUMP_EXE in env file."
    }

    if ([string]::IsNullOrWhiteSpace($Databases)) {
        throw "ReseedDatabases is empty. Set RESEED_DATABASES in env file or pass -ReseedDatabases."
    }

    $dbList = @($Databases.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" })
    if ($dbList.Count -eq 0) {
        throw "ReseedDatabases did not resolve to any database names."
    }

    $dumpDir = Split-Path -Parent $OutputFile
    if (-not [string]::IsNullOrWhiteSpace($dumpDir) -and -not (Test-Path $dumpDir)) {
        New-Item -ItemType Directory -Path $dumpDir -Force | Out-Null
    }

    $args = @(
        "--host=$DbHost",
        "--port=$Port",
        "--user=$User",
        "--protocol=TCP",
        "--single-transaction",
        "--set-gtid-purged=ON",
        "--result-file=$OutputFile",
        "--databases"
    ) + $dbList

    if ($Password -ne "") {
        $args += "--password=$Password"
    }

    $stdoutFile = [System.IO.Path]::GetTempFileName()
    $stderrFile = [System.IO.Path]::GetTempFileName()
    try {
        $process = Start-Process -FilePath $MysqldumpExe -ArgumentList $args -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
        $exitCode = $process.ExitCode

        if ($exitCode -ne 0) {
            $err = Get-Content -Path $stderrFile -Raw -ErrorAction SilentlyContinue
            throw "mysqldump failed (exit $exitCode). $err"
        }
    }
    finally {
        Remove-Item -Path $stdoutFile -ErrorAction SilentlyContinue
        Remove-Item -Path $stderrFile -ErrorAction SilentlyContinue
    }
}

function Import-SqlFileToReplica {
    param(
        [string]$DbHost,
        [int]$Port,
        [string]$User,
        [string]$Password,
        [string]$InputFile
    )

    if (-not (Test-Path $InputFile)) {
        throw "Reseed dump file not found: $InputFile"
    }

    $args = @(
        "--host=$DbHost",
        "--port=$Port",
        "--user=$User",
        "--protocol=TCP",
        "--binary-mode=1",
        "--connect-timeout=10"
    )

    if ($Password -ne "") {
        $args += "--password=$Password"
    }

    $stdoutFile = [System.IO.Path]::GetTempFileName()
    $stderrFile = [System.IO.Path]::GetTempFileName()
    try {
        $process = Start-Process -FilePath $MysqlExe -ArgumentList $args -NoNewWindow -Wait -PassThru -RedirectStandardInput $InputFile -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
        $exitCode = $process.ExitCode

        if ($exitCode -ne 0) {
            $err = Get-Content -Path $stderrFile -Raw -ErrorAction SilentlyContinue
            throw "mysql import failed (exit $exitCode). $err"
        }
    }
    finally {
        Remove-Item -Path $stdoutFile -ErrorAction SilentlyContinue
        Remove-Item -Path $stderrFile -ErrorAction SilentlyContinue
    }
}

if (-not (Get-Command $MysqlExe -ErrorAction SilentlyContinue)) {
    throw "mysql client not found. Install MySQL client or pass -MysqlExe with full path to mysql.exe"
}

$envMap = Load-EnvFile -Path $EnvFile

if (-not $PSBoundParameters.ContainsKey('MysqlExe') -and $envMap.ContainsKey('MYSQL_EXE')) {
    $MysqlExe = $envMap['MYSQL_EXE']
}
if (-not $PSBoundParameters.ContainsKey('MysqldumpExe') -and $envMap.ContainsKey('MYSQLDUMP_EXE')) {
    $MysqldumpExe = $envMap['MYSQLDUMP_EXE']
}
if (-not $PSBoundParameters.ContainsKey('MysqldExe') -and $envMap.ContainsKey('MYSQLD_EXE')) {
    $MysqldExe = $envMap['MYSQLD_EXE']
}
if (-not $PSBoundParameters.ContainsKey('ReplicaDefaultsFile') -and $envMap.ContainsKey('REPLICA_DEFAULTS_FILE')) {
    $ReplicaDefaultsFile = $envMap['REPLICA_DEFAULTS_FILE']
}
if (-not $PSBoundParameters.ContainsKey('SourceHost') -and $envMap.ContainsKey('SOURCE_HOST')) {
    $SourceHost = $envMap['SOURCE_HOST']
}
if (-not $PSBoundParameters.ContainsKey('SourcePort') -and $envMap.ContainsKey('SOURCE_PORT')) {
    $SourcePort = [int]$envMap['SOURCE_PORT']
}
if (-not $PSBoundParameters.ContainsKey('ReplicaHost') -and $envMap.ContainsKey('REPLICA_HOST')) {
    $ReplicaHost = $envMap['REPLICA_HOST']
}
if (-not $PSBoundParameters.ContainsKey('ReplicaPort') -and $envMap.ContainsKey('REPLICA_PORT')) {
    $ReplicaPort = [int]$envMap['REPLICA_PORT']
}
if (-not $PSBoundParameters.ContainsKey('ReplicaAdminUser') -and $envMap.ContainsKey('REPLICA_ADMIN_USER')) {
    $ReplicaAdminUser = $envMap['REPLICA_ADMIN_USER']
}
if (-not $PSBoundParameters.ContainsKey('ReplUser') -and $envMap.ContainsKey('REPL_USER')) {
    $ReplUser = $envMap['REPL_USER']
}
if (-not $PSBoundParameters.ContainsKey('StartReplicaIfDown') -and $envMap.ContainsKey('START_REPLICA_IF_DOWN')) {
    $StartReplicaIfDown = To-BoolOrDefault -Value $envMap['START_REPLICA_IF_DOWN'] -Default $StartReplicaIfDown
}
if (-not $PSBoundParameters.ContainsKey('ReplicaStartWaitSeconds') -and $envMap.ContainsKey('REPLICA_START_WAIT_SECONDS')) {
    $ReplicaStartWaitSeconds = [int]$envMap['REPLICA_START_WAIT_SECONDS']
}
if (-not $PSBoundParameters.ContainsKey('ReseedDatabases') -and $envMap.ContainsKey('RESEED_DATABASES')) {
    $ReseedDatabases = $envMap['RESEED_DATABASES']
}
if (-not $PSBoundParameters.ContainsKey('ReseedDumpFile') -and $envMap.ContainsKey('RESEED_DUMP_FILE')) {
    $ReseedDumpFile = $envMap['RESEED_DUMP_FILE']
}
if (-not $PSBoundParameters.ContainsKey('AutoReseedOn1236') -and $envMap.ContainsKey('AUTO_RESEED_ON_1236')) {
    $AutoReseedOn1236 = To-BoolOrDefault -Value $envMap['AUTO_RESEED_ON_1236'] -Default $AutoReseedOn1236
}

if (-not $ReplicaAdminPassword -and $envMap.ContainsKey('REPLICA_ADMIN_PASSWORD') -and -not [string]::IsNullOrWhiteSpace($envMap['REPLICA_ADMIN_PASSWORD'])) {
    $ReplicaAdminPassword = ConvertTo-SecureString $envMap['REPLICA_ADMIN_PASSWORD'] -AsPlainText -Force
}
if (-not $ReplPassword -and $envMap.ContainsKey('REPL_PASSWORD') -and -not [string]::IsNullOrWhiteSpace($envMap['REPL_PASSWORD'])) {
    $ReplPassword = ConvertTo-SecureString $envMap['REPL_PASSWORD'] -AsPlainText -Force
}

if (-not (Get-Command $MysqlExe -ErrorAction SilentlyContinue)) {
    throw "mysql client not found after env load. Pass -MysqlExe or set MYSQL_EXE in $EnvFile"
}

Ensure-ReplicaRunning -TargetHost $ReplicaHost -Port $ReplicaPort -AllowStart $StartReplicaIfDown -MysqldPath $MysqldExe -DefaultsFile $ReplicaDefaultsFile -WaitSeconds $ReplicaStartWaitSeconds

if (-not $ReplicaAdminPassword) {
    $ReplicaAdminPassword = Read-Host "Enter replica admin password (${ReplicaAdminUser}@${ReplicaHost}:${ReplicaPort})" -AsSecureString
}

$replicaAdminPlain = ConvertTo-PlainText -Secure $ReplicaAdminPassword

$sourceCheckUser = $ReplicaAdminUser
$sourceCheckPass = $replicaAdminPlain

Write-Host "Checking source reachability at ${SourceHost}:${SourcePort}..."
$sourceCheck = Invoke-MySql -DbHost $SourceHost -Port $SourcePort -User $sourceCheckUser -Password $sourceCheckPass -Query "SELECT @@server_id, @@port;"
if ($sourceCheck.ExitCode -ne 0) {
    Write-Host "Source pre-check failed with user $sourceCheckUser. Continuing with replica checks and repair steps." -ForegroundColor Yellow
    Write-Host "Source check output: $($sourceCheck.Output.Trim())" -ForegroundColor Yellow
}
else {
    Write-Host "Source is reachable."
}

Write-Host "Reading replica status from ${ReplicaHost}:${ReplicaPort}..."
$status = Get-ReplicaStatusMap -DbHost $ReplicaHost -Port $ReplicaPort -User $ReplicaAdminUser -Password $replicaAdminPlain -AllowEmpty

if ($status.Count -eq 0) {
    Write-Host "Replica channel is not configured yet on ${ReplicaHost}:${ReplicaPort}." -ForegroundColor Yellow
}
else {
    Print-Health -Status $status
}

$ioOk = ($status['Replica_IO_Running'] -eq 'Yes')
$sqlOk = ($status['Replica_SQL_Running'] -eq 'Yes')

if ($ioOk -and $sqlOk -and -not $ForceChannelReset) {
    Write-Host "Replication is healthy. No action needed."
    exit 0
}

if (-not $AutoRepair -and -not $ForceChannelReset) {
    Write-Host "Replication is not healthy. Re-run with -AutoRepair to attempt automatic fix." -ForegroundColor Yellow
    exit 2
}

$lastIoError = $status['Last_IO_Error']
$looksLike1236 = $lastIoError -match '1236'
$mustReset = $ForceChannelReset -or $looksLike1236 -or ($status.Count -eq 0)

Write-Host "Attempting repair..." -ForegroundColor Yellow

# First, try a simple IO restart when reset is not required.
if (-not $mustReset) {
    $simpleRestart = Invoke-MySql -DbHost $ReplicaHost -Port $ReplicaPort -User $ReplicaAdminUser -Password $replicaAdminPlain -Query "STOP REPLICA; START REPLICA IO_THREAD;"
    if ($simpleRestart.ExitCode -eq 0) {
        $status = Get-ReplicaStatusMap -DbHost $ReplicaHost -Port $ReplicaPort -User $ReplicaAdminUser -Password $replicaAdminPlain
        Print-Health -Status $status
        if ($status['Replica_IO_Running'] -eq 'Yes' -and $status['Replica_SQL_Running'] -eq 'Yes') {
            Write-Host "Repair successful via IO thread restart."
            exit 0
        }
    }
}

if (-not $ReplPassword) {
    $ReplPassword = Read-Host "Enter replication user password ($ReplUser)" -AsSecureString
}
$replPlain = ConvertTo-PlainText -Secure $ReplPassword
if ($replPlain -eq "") {
    throw "Replication user password is required for channel reset repair."
}

$resetSql = @"
STOP REPLICA;
RESET REPLICA ALL;
CHANGE REPLICATION SOURCE TO
  SOURCE_HOST = '$SourceHost',
  SOURCE_PORT = $SourcePort,
  SOURCE_USER = '$ReplUser',
  SOURCE_PASSWORD = '$replPlain',
  SOURCE_AUTO_POSITION = 1,
  GET_SOURCE_PUBLIC_KEY = 1;
START REPLICA;
"@

$resetResult = Invoke-MySql -DbHost $ReplicaHost -Port $ReplicaPort -User $ReplicaAdminUser -Password $replicaAdminPlain -Query $resetSql
if ($resetResult.ExitCode -ne 0) {
    throw "Channel reset failed. Output: $($resetResult.Output.Trim())"
}

$status = Get-ReplicaStatusMap -DbHost $ReplicaHost -Port $ReplicaPort -User $ReplicaAdminUser -Password $replicaAdminPlain -AllowEmpty

if ($status.Count -eq 0) {
    Write-Host "Repair attempted, but replica channel is still not configured on ${ReplicaHost}:${ReplicaPort}." -ForegroundColor Yellow
    Write-Host "Verify admin privileges and replication user credentials, then run again." -ForegroundColor Yellow
    exit 3
}

Print-Health -Status $status

if ($status['Replica_IO_Running'] -eq 'Yes' -and $status['Replica_SQL_Running'] -eq 'Yes') {
    Write-Host "Repair successful. Replication is healthy." -ForegroundColor Green
    exit 0
}

if ($AutoReseedOn1236 -and ($status['Last_IO_Error'] -match '1236')) {
    Write-Host "Detected 1236 after reset. Running auto-reseed from source snapshot..." -ForegroundColor Yellow

    Invoke-MySql -DbHost $ReplicaHost -Port $ReplicaPort -User $ReplicaAdminUser -Password $replicaAdminPlain -Query "STOP REPLICA; RESET REPLICA ALL; RESET BINARY LOGS AND GTIDS;" | Out-Null

    $maintenanceToggle = Invoke-MySql -DbHost $ReplicaHost -Port $ReplicaPort -User $ReplicaAdminUser -Password $replicaAdminPlain -Query "SET GLOBAL super_read_only = OFF; SET GLOBAL read_only = OFF;"
    if ($maintenanceToggle.ExitCode -ne 0) {
        throw "Failed to disable read-only mode for reseed import. Output: $($maintenanceToggle.Output.Trim())"
    }

    Invoke-MysqldumpToFile -DbHost $SourceHost -Port $SourcePort -User $ReplicaAdminUser -Password $replicaAdminPlain -Databases $ReseedDatabases -OutputFile $ReseedDumpFile
    Import-SqlFileToReplica -DbHost $ReplicaHost -Port $ReplicaPort -User $ReplicaAdminUser -Password $replicaAdminPlain -InputFile $ReseedDumpFile

    $maintenanceRestore = Invoke-MySql -DbHost $ReplicaHost -Port $ReplicaPort -User $ReplicaAdminUser -Password $replicaAdminPlain -Query "SET GLOBAL read_only = ON; SET GLOBAL super_read_only = ON;"
    if ($maintenanceRestore.ExitCode -ne 0) {
        throw "Failed to restore read-only mode after reseed import. Output: $($maintenanceRestore.Output.Trim())"
    }

    $reseedSql = @"
CHANGE REPLICATION SOURCE TO
  SOURCE_HOST = '$SourceHost',
  SOURCE_PORT = $SourcePort,
  SOURCE_USER = '$ReplUser',
  SOURCE_PASSWORD = '$replPlain',
  SOURCE_AUTO_POSITION = 1,
  GET_SOURCE_PUBLIC_KEY = 1;
START REPLICA;
"@

    $reseedBindResult = Invoke-MySql -DbHost $ReplicaHost -Port $ReplicaPort -User $ReplicaAdminUser -Password $replicaAdminPlain -Query $reseedSql
    if ($reseedBindResult.ExitCode -ne 0) {
        throw "Auto-reseed channel bind failed. Output: $($reseedBindResult.Output.Trim())"
    }

    $status = Get-ReplicaStatusMap -DbHost $ReplicaHost -Port $ReplicaPort -User $ReplicaAdminUser -Password $replicaAdminPlain -AllowEmpty
    if ($status.Count -gt 0) {
        Print-Health -Status $status
    }

    if ($status['Replica_IO_Running'] -eq 'Yes' -and $status['Replica_SQL_Running'] -eq 'Yes') {
        Write-Host "Auto-reseed successful. Replication is healthy." -ForegroundColor Green
        exit 0
    }
}

Write-Host "Repair did not fully recover replication. You likely need a fresh replica reseed from source snapshot." -ForegroundColor Yellow
exit 3
