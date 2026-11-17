# Exemples de réponses d'AlgoLightHouse (ALH) pour les tests du connecteur (ADR 0100, connecteur EASM).
# Windows PowerShell 5.1 ou PowerShell 7, sans droits d'administrateur. Lecture seule : uniquement des appels GET.
# Les réponses sont anonymisées avant d'être écrites dans le dossier « exemples-alh » du dossier courant :
# tout texte est remplacé par sa longueur, sauf une liste fermée de champs techniques (statut, type, CVE, produit, version).
# À RELIRE avant tout envoi : le dépôt est public. Ne jamais transmettre la clé d'API.

$Base = (Read-Host 'Adresse de votre espace ALH, par exemple https://monespace.algolighthouse.fr').TrimEnd('/')
$CleSure = Read-Host 'Clé d''API' -AsSecureString
$Cle = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($CleSure))
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
# Sortie par le proxy du poste, avec le compte Windows de la session.
[System.Net.WebRequest]::DefaultWebProxy.Credentials = [System.Net.CredentialCache]::DefaultCredentials
$Entetes = @{ 'X-API-Key' = $Cle }
$Dossier = Join-Path (Get-Location) 'exemples-alh'
New-Item -ItemType Directory -Force -Path $Dossier | Out-Null
$Resume = New-Object System.Collections.ArrayList
$MaxElements = 3

# Champs dont la valeur est gardée telle quelle : vocabulaire technique, jamais un nom, une adresse ou un texte libre.
$Gardes = 'status', 'type', 'fragment_type', 'version_status', 'severity', 'cve', 'vendor', 'product', 'version',
  'latest_version', 'cpe', 'technology', 'display_name', 'template_id', 'cwe_id'
$Valeurs = 'typosquatting', 'data_leak', 'exposed_service', 'vulnerable_service', 'config_defect', 'minor', 'important', 'major', 'critical'
# Champs retirés en entier, quel que soit leur contenu.
$Retires = 'sensitive_data', 'uploads', 'note', 'comments', 'defects', 'data'

$Table = @{}
function Remplacer([string]$Valeur) {
  if (-not $Table.ContainsKey($Valeur)) { $Table[$Valeur] = 'ID-{0:d3}' -f ($Table.Count + 1) }
  return $Table[$Valeur]
}

function Nettoyer($Objet, [string]$Champ) {
  if ($null -eq $Objet) { return $null }
  if ($Objet -is [string]) {
    if ($Gardes -contains $Champ) { return $Objet }
    # « value » sert au type et à la criticité, mais aussi à la cible (adresse, domaine, mot-clé) : gardé pour ce vocabulaire seulement.
    if ($Champ -eq 'value' -and $Valeurs -contains $Objet) { return $Objet }
    if ($Objet -match '^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$') { return $Objet }
    if ($Champ -eq 'id' -or $Champ -like '*_id') { return (Remplacer $Objet) }
    return "(texte de $($Objet.Length) caractères)"
  }
  if ($Objet -is [System.Array]) {
    $Liste = New-Object System.Collections.ArrayList
    foreach ($Element in ($Objet | Select-Object -First $MaxElements)) { [void]$Liste.Add((Nettoyer $Element $Champ)) }
    return , $Liste.ToArray()
  }
  if ($Objet -is [System.Management.Automation.PSCustomObject]) {
    $Sortie = [ordered]@{}
    foreach ($P in $Objet.PSObject.Properties) {
      if ($Retires -contains $P.Name) { $Sortie[$P.Name] = '(retiré)' }
      else { $Sortie[$P.Name] = Nettoyer $P.Value $P.Name }
    }
    return $Sortie
  }
  return $Objet
}

function Lire([string]$Fichier, [string]$Chemin) {
  try {
    $Reponse = Invoke-RestMethod -Uri ($Base + $Chemin) -Method Get -Headers $Entetes
    $Nombre = @($Reponse).Count
    [void]$Resume.Add("$Fichier : $Nombre élément(s) reçus, $([Math]::Min($Nombre, $MaxElements)) gardé(s)")
    $Texte = ConvertTo-Json -InputObject (Nettoyer $Reponse '') -Depth 30
    $Texte | Out-File -FilePath (Join-Path $Dossier $Fichier) -Encoding utf8
    Write-Host "OK      $Fichier ($Nombre élément(s))"
    return $Reponse
  }
  catch { Write-Host "ECHEC   $Fichier : $($_.Exception.Message)"; return $null }
}

[void](Lire '1-sante.json' '/api/v1/health')
[void](Lire '2-version.json' '/api/v1/version')
[void](Lire '3-perimetres.json' '/api/v1/perimeters')
[void](Lire '4-hotes.json' '/api/v1/targets/hosts')
[void](Lire '5-domaines.json' '/api/v1/targets/domains')
[void](Lire '6-technologies.json' '/api/v1/technologies')
$Alertes = Lire '7-alertes.json' '/api/v1/alerts'

# Détail d'une alerte par type rencontré (cinq au plus) : c'est là que se trouvent les CVE et les constats.
$Vus = @{}
$Rang = 0
foreach ($Alerte in @($Alertes)) {
  if ($null -eq $Alerte -or $Vus.ContainsKey([string]$Alerte.type_id) -or $Rang -ge 5) { continue }
  $Vus[[string]$Alerte.type_id] = $true
  $Rang++
  [void](Lire "8-alerte-detail-$Rang.json" "/api/v1/alerts/$($Alerte.id)")
}

$Resume | Out-File -FilePath (Join-Path $Dossier '0-resume.txt') -Encoding utf8
$Cle = $null
Write-Host ''
Write-Host "Fichiers écrits dans : $Dossier"
Write-Host 'Relisez-les avant de les transmettre : aucun domaine, adresse, nom de personne ni donnée de fuite ne doit rester.'
Read-Host 'Appuyez sur Entrée pour fermer' | Out-Null
