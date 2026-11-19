# Résume un export JSON du rapport d'analyse Active Directory de l'ANSSI (service ADS, « Télécharger les données au format
# JSON ») : ne garde que ce qui décrit les points de contrôle, jamais le contenu de l'annuaire.
# Windows PowerShell 5.1 ou PowerShell 7, sans droits d'administrateur. Ne contacte aucun service : il lit un fichier local.
# Gardé, par point de contrôle : son identifiant public (`module_ref`), son type, son niveau, son score, s'il est actif, le
# nombre d'objets relevés et les NOMS des rubriques de `attrs` (pas leur contenu). Gardé, pour la synthèse : le niveau, la
# progression par niveau, les dates d'analyse. Écarté : noms distinctifs, comptes, serveurs, SID, certificats, nombres
# d'utilisateurs et de machines, nom de la forêt.
# À RELIRE avant tout envoi : le dépôt est public.

$Source = (Read-Host 'Chemin du fichier JSON exporté du rapport').Trim('"')
if (-not (Test-Path -LiteralPath $Source)) { Write-Host "Fichier introuvable : $Source"; Read-Host 'Entrée pour fermer' | Out-Null; exit 1 }
# Le nom du fichier d'origine n'est pas repris : il porte le nom de la forêt.
$Sortie = Join-Path (Split-Path -Parent (Resolve-Path -LiteralPath $Source)) ('resume-ads-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')
$Texte = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $Source), [Text.Encoding]::UTF8)

# Lecture en dictionnaires : PowerShell 7 par ConvertFrom-Json -AsHashtable, Windows PowerShell 5.1 par le lecteur de .NET.
if ($PSVersionTable.PSVersion.Major -ge 6) { $Donnees = $Texte | ConvertFrom-Json -AsHashtable -Depth 100 }
else {
  Add-Type -AssemblyName System.Web.Extensions
  $Lecteur = New-Object System.Web.Script.Serialization.JavaScriptSerializer
  $Lecteur.MaxJsonLength = [int]::MaxValue
  $Lecteur.RecursionLimit = 200
  $Donnees = $Lecteur.DeserializeObject($Texte)
}

# Un identifiant de point de contrôle est public (lettres, chiffres, tiret bas) ; toute autre valeur est remplacée.
function Identifiant($Valeur) {
  if ($Valeur -is [string] -and $Valeur -cmatch '^[a-z0-9_]{1,80}$') { return $Valeur }
  if ($null -eq $Valeur) { return $null }
  return '(valeur écartée)'
}
function Nombre($Valeur) { if ($Valeur -is [int] -or $Valeur -is [long] -or $Valeur -is [double] -or $Valeur -is [decimal]) { return $Valeur } return $null }
function Date($Valeur) { if ($Valeur -is [string] -and $Valeur -match '^\d{4}-\d{2}-\d{2}[T ][\d:]+$') { return $Valeur } return $null }

$Points = New-Object System.Collections.ArrayList
foreach ($R in @($Donnees['results'])) {
  $Rubriques = [ordered]@{}
  if ($R['attrs'] -is [System.Collections.IDictionary]) {
    foreach ($Cle in $R['attrs'].Keys) {
      $V = $R['attrs'][$Cle]
      $Nom = Identifiant ([string]$Cle)
      if ($V -is [System.Collections.IEnumerable] -and $V -isnot [string] -and $V -isnot [System.Collections.IDictionary]) { $Rubriques[$Nom] = @($V).Count }
      else { $Rubriques[$Nom] = '(non compté)' }
    }
  }
  [void]$Points.Add([ordered]@{
      module_ref = Identifiant $R['module_ref']
      type       = Nombre $R['type']
      grade      = Nombre $R['grade']
      score      = Nombre $R['score']
      active     = [bool]$R['active']
      rubriques  = $Rubriques
    })
}

$S = $Donnees['summary']
$A = if ($S -is [System.Collections.IDictionary]) { $S['attrs'] } else { $null }
$Resume = [ordered]@{
  points   = $Points.ToArray()
  synthese = [ordered]@{
    grade                     = if ($S) { Nombre $S['grade'] } else { $null }
    analysis_date             = if ($A) { Date $A['analysis_date'] } else { $null }
    processing_date           = if ($A) { Date $A['processing_date'] } else { $null }
    forest_complete           = if ($A) { [bool]$A['forest_complete'] } else { $null }
    error_count               = if ($A) { Nombre $A['error_count'] } else { $null }
    progress_data             = if ($A) { $A['progress_data'] } else { $null }
    progress_prev_global      = if ($A) { Nombre $A['progress_prev_global'] } else { $null }
    progress_worst_global     = if ($A) { Nombre $A['progress_worst_global'] } else { $null }
    progress_worst_pct_global = if ($A) { Nombre $A['progress_worst_pct_global'] } else { $null }
  }
  filtered = [bool]$Donnees['filtered']
}

ConvertTo-Json -InputObject $Resume -Depth 20 | Out-File -FilePath $Sortie -Encoding utf8
Write-Host ''
Write-Host "Fichier écrit : $Sortie"
Write-Host "Points de contrôle : $($Points.Count)"
Write-Host 'Relisez-le avant de le transmettre : il ne doit contenir que des identifiants de points de contrôle, des nombres'
Write-Host 'et des dates, aucun nom de domaine, de compte ni de serveur.'
Read-Host 'Appuyez sur Entrée pour fermer' | Out-Null
