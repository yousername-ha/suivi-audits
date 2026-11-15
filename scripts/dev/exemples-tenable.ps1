# Exemples de réponses de Tenable Security Center pour les tests du connecteur (ADR 0100, lot V5).
# Windows PowerShell 5.1 ou PowerShell 7, sans droits d'administrateur. Lecture seule : rien n'est modifié dans Tenable.
# Les réponses sont anonymisées avant d'être écrites dans le dossier « exemples-tenable » du dossier courant.
# À RELIRE avant tout envoi : le dépôt est public. Ne jamais transmettre les clés d'API.

$Base = (Read-Host 'Adresse de Tenable, par exemple https://tenable.exemple.local').TrimEnd('/')
$Acces = Read-Host 'Clé d''accès (access key)'
$SecretSur = Read-Host 'Clé secrète (secret key)' -AsSecureString
$Secret = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecretSur))
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Entetes = @{ 'x-apikey' = "accesskey=$Acces; secretkey=$Secret;" }
$Dossier = Join-Path (Get-Location) 'exemples-tenable'
New-Item -ItemType Directory -Force -Path $Dossier | Out-Null

# Valeurs remplacées, avec un numéro stable par valeur d'origine.
$Table = @{}
function Remplacer([string]$Valeur, [string]$Prefixe) {
  if ([string]::IsNullOrEmpty($Valeur)) { return $Valeur }
  $Cle = "$Prefixe|$Valeur"
  if (-not $Table.ContainsKey($Cle)) { $Table[$Cle] = '{0}-{1:d3}' -f $Prefixe, ($Table.Count + 1) }
  return $Table[$Cle]
}
$Noms = 'dnsName', 'netbiosName', 'netBios', 'netBiosWorkgroup', 'hostName', 'hostname', 'fqdn', 'names'
$Identifiants = 'uuid', 'tenableUUID', 'hostUUID', 'hostUniqueness', 'macAddress', 'macs'
$Retires = 'pluginText', 'pluginOutput', 'tags', 'segments'

function Nettoyer($Objet, [bool]$NomEstMachine) {
  if ($null -eq $Objet) { return }
  if ($Objet -is [System.Array]) { foreach ($Element in $Objet) { Nettoyer $Element $NomEstMachine }; return }
  if ($Objet -isnot [System.Management.Automation.PSCustomObject]) { return }
  foreach ($P in @($Objet.PSObject.Properties)) {
    if ($Retires -contains $P.Name) { $P.Value = '(retiré)'; continue }
    if ($P.Value -is [string]) {
      if ($Noms -contains $P.Name) { $P.Value = Remplacer $P.Value 'MACHINE' }
      elseif ($Identifiants -contains $P.Name) { $P.Value = Remplacer $P.Value 'ID' }
      elseif ($P.Name -eq 'name' -and $NomEstMachine) { $P.Value = Remplacer $P.Value 'MACHINE' }
      elseif ($P.Name -eq 'name' -and $Objet.PSObject.Properties.Name -contains 'dataFormat') { $P.Value = Remplacer $P.Value 'DEPOT' }
    }
    else { Nettoyer $P.Value $NomEstMachine }
  }
}

function Lire([string]$Fichier, [string]$Methode, [string]$Chemin, [string]$Corps, [bool]$NomEstMachine) {
  try {
    if ($Corps) { $Reponse = Invoke-RestMethod -Uri ($Base + $Chemin) -Method $Methode -Headers $Entetes -ContentType 'application/json' -Body $Corps }
    else { $Reponse = Invoke-RestMethod -Uri ($Base + $Chemin) -Method $Methode -Headers $Entetes }
    Nettoyer $Reponse $NomEstMachine
    $Texte = $Reponse | ConvertTo-Json -Depth 30
    # Adresses IPv4 restantes, où qu'elles soient : plage réservée à la documentation.
    $Texte = [regex]::Replace($Texte, '\b(?:\d{1,3}\.){3}\d{1,3}\b', { param($m) '192.0.2.' + ((([Math]::Abs($m.Value.GetHashCode())) % 250) + 1) })
    $Texte = $Texte.Replace(([uri]$Base).Host, 'tenable.exemple.local')
    $Texte | Out-File -FilePath (Join-Path $Dossier $Fichier) -Encoding utf8
    Write-Host "OK      $Fichier"
  }
  catch { Write-Host "ECHEC   $Fichier : $($_.Exception.Message)" }
}

function Requete([string]$Outil, [string]$Gravites) {
  return '{"type":"vuln","sourceType":"cumulative","startOffset":0,"endOffset":5,"query":{"type":"vuln","tool":"' + $Outil +
    '","filters":[{"filterName":"severity","operator":"=","value":"' + $Gravites + '"}]}}'
}

Lire '1-systeme.json' 'GET' '/rest/system' '' $false
Lire '2-failles-agregees.json' 'POST' '/rest/analysis' (Requete 'sumid' '3,4') $false
Lire '3-failles-par-machine.json' 'POST' '/rest/analysis' (Requete 'vulndetails' '4') $false
Lire '4-machines.json' 'GET' '/rest/hosts?limit=5' '' $true
Lire '5-correctifs.json' 'POST' '/rest/solutions' (Requete 'sumid' '3,4') $false

$Secret = $null
Write-Host ''
Write-Host "Fichiers écrits dans : $Dossier"
Write-Host 'Relisez-les avant de les transmettre : aucun nom de machine, de domaine, de personne ni adresse réelle ne doit rester.'
