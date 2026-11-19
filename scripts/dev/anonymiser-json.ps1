# Anonymise un fichier JSON pour en montrer la FORME sans en montrer le contenu (rapports ORADAD, Silène ou autre).
# Windows PowerShell 5.1 ou PowerShell 7, sans droits d'administrateur. Ne contacte aucun service : il lit un fichier local.
# Tout texte est remplacé par sa longueur (« texte de 23 caractères ») ; seuls restent les noms des champs, les nombres,
# les booléens et les dates. Chaque liste est réduite à ses trois premiers éléments, son nombre réel est noté à côté.
# À RELIRE avant tout envoi : le dépôt est public. Un nom de champ peut lui-même être parlant (nom de domaine utilisé comme clé).

$Source = (Read-Host 'Chemin du fichier JSON à anonymiser').Trim('"')
if (-not (Test-Path -LiteralPath $Source)) { Write-Host "Fichier introuvable : $Source"; Read-Host 'Entrée pour fermer' | Out-Null; exit 1 }
$Sortie = Join-Path (Split-Path -Parent (Resolve-Path -LiteralPath $Source)) ('forme-' + [IO.Path]::GetFileNameWithoutExtension($Source) + '.json')
$MaxElements = 3
$Texte = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $Source), [Text.Encoding]::UTF8)

# Lecture : ConvertFrom-Json refuse les gros fichiers sous PowerShell 5.1 ; repli sur le lecteur de .NET, sans limite de taille.
try { $Donnees = $Texte | ConvertFrom-Json -ErrorAction Stop }
catch {
  Add-Type -AssemblyName System.Web.Extensions
  $Lecteur = New-Object System.Web.Script.Serialization.JavaScriptSerializer
  $Lecteur.MaxJsonLength = [int]::MaxValue
  $Lecteur.RecursionLimit = 200
  $Donnees = $Lecteur.DeserializeObject($Texte)
}

function Nettoyer($Objet) {
  if ($null -eq $Objet) { return $null }
  if ($Objet -is [string]) {
    if ($Objet -match '^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$') { return $Objet }
    return "(texte de $($Objet.Length) caractères)"
  }
  if ($Objet -is [System.Collections.IDictionary]) {
    $Resultat = [ordered]@{}
    foreach ($Cle in $Objet.Keys) { $Resultat[[string]$Cle] = Nettoyer $Objet[$Cle] }
    return $Resultat
  }
  if ($Objet -is [System.Management.Automation.PSCustomObject]) {
    $Resultat = [ordered]@{}
    foreach ($P in $Objet.PSObject.Properties) { $Resultat[$P.Name] = Nettoyer $P.Value }
    return $Resultat
  }
  if ($Objet -is [System.Collections.IEnumerable]) {
    $Tous = @($Objet)
    $Liste = New-Object System.Collections.ArrayList
    foreach ($Element in ($Tous | Select-Object -First $MaxElements)) { [void]$Liste.Add((Nettoyer $Element)) }
    if ($Tous.Count -gt $MaxElements) { [void]$Liste.Add("(liste de $($Tous.Count) éléments, $MaxElements gardés)") }
    return , $Liste.ToArray()
  }
  return $Objet
}

ConvertTo-Json -InputObject (Nettoyer $Donnees) -Depth 60 | Out-File -FilePath $Sortie -Encoding utf8
Write-Host ''
Write-Host "Fichier écrit : $Sortie"
Write-Host 'Relisez-le avant de le transmettre : aucun nom de domaine, de compte, de serveur ni adresse ne doit rester,'
Write-Host 'y compris dans les NOMS des champs.'
Read-Host 'Appuyez sur Entrée pour fermer' | Out-Null
