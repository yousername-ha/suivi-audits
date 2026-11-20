# Vérification en lecture seule : où AlgoLightHouse (ALH) publie-t-il les ports ouverts dans son API ? (ADR 0100, lot ALH6).
# Windows PowerShell 5.1 ou PowerShell 7, sans droits d'administrateur. Uniquement des appels GET, parmi ceux que le
# connecteur de la plateforme utilise déjà : liste des hôtes, liste des alertes, détail d'au plus 40 alertes ouvertes.
# Le fichier produit ne contient que des NOMS de champs, des nombres et des numéros de port (22, 443…) : aucune adresse,
# aucun nom de domaine, aucun identifiant, aucun texte d'alerte. Ne jamais transmettre la clé d'API.
# À RELIRE avant tout envoi : le dépôt est public.

$Base = (Read-Host 'Adresse de votre espace ALH, par exemple https://monespace.algolighthouse.fr').TrimEnd('/')
$CleSure = Read-Host 'Clé d''API' -AsSecureString
$Cle = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($CleSure))
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
# Sortie par le proxy du poste, avec le compte Windows de la session.
[System.Net.WebRequest]::DefaultWebProxy.Credentials = [System.Net.CredentialCache]::DefaultCredentials
$Entetes = @{ 'X-API-Key' = $Cle }
$Sortie = Join-Path (Get-Location) ('verif-ports-alh-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.txt')
$Lignes = New-Object System.Collections.ArrayList
$MaxDetails = 40
$Motif = 'port|service|open|protocol|banner|listen'

function Appeler([string]$Chemin) {
  try { return Invoke-RestMethod -Uri ($Base + $Chemin) -Method Get -Headers $Entetes }
  catch { [void]$Lignes.Add("ÉCHEC GET $($Chemin -replace '[0-9a-fA-F-]{36}', '{identifiant}') : $($_.Exception.Message)"); return $null }
}
# Noms de champs d'un objet, en profondeur, sous la forme a.b[].c ; jamais de valeur.
function Chemins($Objet, [string]$Prefixe, $Vers) {
  if ($Objet -is [System.Array]) { foreach ($E in ($Objet | Select-Object -First 20)) { Chemins $E ($Prefixe + '[]') $Vers }; return }
  if ($Objet -is [System.Management.Automation.PSCustomObject]) {
    foreach ($P in $Objet.PSObject.Properties) {
      # Un nom de champ qui ressemble à une donnée (adresse, nom de domaine, identifiant) est masqué.
      $Nom = if ($P.Name -match '^[A-Za-z_][A-Za-z0-9_-]{0,40}$' -and $P.Name -notmatch '\d{3,}') { $P.Name } else { '(clé masquée)' }
      $C = if ($Prefixe) { "$Prefixe.$Nom" } else { $Nom }
      $Vers[$C] = 1 + [int]$Vers[$C]
      Chemins $P.Value $C $Vers
    }
  }
}
function Rapport([string]$Titre, $Vers) {
  [void]$Lignes.Add($Titre)
  $Touche = @($Vers.Keys | Where-Object { $_ -match $Motif } | Sort-Object)
  if ($Touche.Count -eq 0) { [void]$Lignes.Add('  aucun champ dont le nom évoque un port ou un service') }
  foreach ($C in $Touche) { [void]$Lignes.Add("  $C  (vu $($Vers[$C]) fois)") }
}

# 1. Hôtes : un champ de la liste porte-t-il des ports ?
$Hotes = @(Appeler '/api/v1/targets/hosts')
[void]$Lignes.Add("Hôtes reçus : $($Hotes.Count)")
$VersHotes = @{}
Chemins $Hotes '' $VersHotes
[void]$Lignes.Add("Tous les champs d'un hôte : $((@($VersHotes.Keys) | Sort-Object) -join ', ')")
Rapport 'Champs d''un hôte qui évoquent un port ou un service :' $VersHotes
[void]$Lignes.Add('')

# 2. Alertes : types de fragments de leur détail, et champs des fragments.
$Alertes = @(Appeler '/api/v1/alerts')
$Ouvertes = @($Alertes | Where-Object { $null -ne $_ -and @('completed', 'abandoned', 'accepted-risk') -notcontains $_.status })
[void]$Lignes.Add("Alertes reçues : $($Alertes.Count) ; encore ouvertes : $($Ouvertes.Count) ; détails lus : $([Math]::Min($Ouvertes.Count, $MaxDetails))")
$ParType = @{}
$VersFragments = @{}
$Ports = @{}
$AvecPort = 0
foreach ($Alerte in ($Ouvertes | Select-Object -First $MaxDetails)) {
  $Detail = Appeler "/api/v1/alerts/$($Alerte.id)"
  if ($null -eq $Detail) { continue }
  $ADesPorts = $false
  foreach ($Propriete in $Detail.PSObject.Properties) {
    # Les fragments sont des listes d'objets portant « fragment_type » ou « json_data », quel que soit le nom du champ.
    foreach ($Fragment in @($Propriete.Value)) {
      if ($Fragment -isnot [System.Management.Automation.PSCustomObject]) { continue }
      $Noms = @($Fragment.PSObject.Properties.Name)
      if ($Noms -notcontains 'json_data' -and $Noms -notcontains 'fragment_type') { continue }
      $Type = if ($Fragment.fragment_type -is [string] -and $Fragment.fragment_type -match '^[a-z_]{1,40}$') { $Fragment.fragment_type } else { '(type absent ou hors norme)' }
      $ParType[$Type] = 1 + [int]$ParType[$Type]
      if ($null -eq $VersFragments[$Type]) { $VersFragments[$Type] = @{} }
      Chemins $Fragment.json_data 'json_data' $VersFragments[$Type]
      $Donnees = $Fragment.json_data
      if ($Donnees -is [System.Management.Automation.PSCustomObject]) {
        foreach ($Valeur in (@($Donnees.port) + @($Donnees.ports))) {
          $Numero = 0
          if ([int]::TryParse([string]$Valeur, [ref]$Numero) -and $Numero -ge 1 -and $Numero -le 65535) { $Ports[$Numero] = 1 + [int]$Ports[$Numero]; $ADesPorts = $true }
        }
      }
    }
  }
  if ($ADesPorts) { $AvecPort++ }
}
[void]$Lignes.Add("Alertes ouvertes dont un fragment cite un port : $AvecPort")
[void]$Lignes.Add('Fragments par type :')
foreach ($T in ($ParType.Keys | Sort-Object)) { [void]$Lignes.Add("  $T : $($ParType[$T])") }
foreach ($T in ($VersFragments.Keys | Sort-Object)) { Rapport "Champs des fragments de type « $T » qui évoquent un port ou un service :" $VersFragments[$T] }
[void]$Lignes.Add('')
[void]$Lignes.Add("Numéros de port distincts cités par ces alertes : $($Ports.Count)")
[void]$Lignes.Add("  $((@($Ports.Keys) | Sort-Object) -join ', ')")
[void]$Lignes.Add('')
[void]$Lignes.Add('Lecture : si aucun champ d''un hôte n''évoque un port, l''API ne publie les ports que dans le détail des alertes ouvertes ;')
[void]$Lignes.Add('comparez le nombre de ports ci-dessus à ce que montre l''interface web d''ALH pour vos hôtes.')

$Cle = $null
$Lignes | Out-File -FilePath $Sortie -Encoding utf8
Write-Host ''
$Lignes | ForEach-Object { Write-Host $_ }
Write-Host ''
Write-Host "Fichier écrit : $Sortie"
Write-Host 'Relisez-le avant de le transmettre : il ne doit contenir que des noms de champs, des nombres et des numéros de port.'
Read-Host 'Appuyez sur Entrée pour fermer' | Out-Null
