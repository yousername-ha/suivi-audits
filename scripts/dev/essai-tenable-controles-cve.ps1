# Essai en lecture seule : Tenable Security Center sait-il chercher ses contrôles par identifiant CVE ? (ADR 0100, « CVE
# inconnue de la veille »). Windows PowerShell 5.1 ou PowerShell 7, sans droits d'administrateur.
# - Trois requêtes GET au plus sur /rest/plugin, pour UNE CVE publique connue. Rien n'est modifié dans Tenable.
# - Connexion directe à Security Center, sans mandataire. Le certificat est toujours vérifié : s'il est signé par une
#   autorité interne que ce poste ne connaît pas, le script échoue et le dit ; il ne contourne jamais la vérification.
# - Le fichier produit ne contient que le catalogue public de Tenable (numéro, nom et famille de contrôles) et des noms de
#   champs : aucune machine, aucune adresse, aucun résultat de scan. Ne jamais transmettre les clés d'API.
# À RELIRE avant tout envoi : le dépôt est public.

$Base = (Read-Host 'Adresse de Tenable Security Center, par exemple https://tenable.exemple.local').TrimEnd('/')
$Acces = Read-Host 'Clé d''accès (access key)'
$SecretSur = Read-Host 'Clé secrète (secret key)' -AsSecureString
$Secret = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecretSur))
$Cve = 'CVE-2021-44228'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Entetes = @{ 'x-apikey' = "accesskey=$Acces; secretkey=$Secret;" }
$Sortie = Join-Path (Get-Location) ('essai-tenable-cve-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.txt')
$Lignes = New-Object System.Collections.ArrayList
[void]$Lignes.Add("Essai de recherche de contrôles par CVE ($Cve) sur /rest/plugin")
[void]$Lignes.Add("PowerShell $($PSVersionTable.PSVersion)")

# Connexion directe : aucun mandataire, quelle que soit la configuration du poste.
$Direct = @{}
if ($PSVersionTable.PSVersion.Major -ge 6) { $Direct['NoProxy'] = $true }
else { [System.Net.WebRequest]::DefaultWebProxy = New-Object System.Net.WebProxy }

$Champs = 'id,name,family,type,xrefs,exploitAvailable,exploitEase,exploitFrameworks,riskFactor,vulnPubDate,patchPubDate,pluginPubDate'
$Essais = @(
  @{ Nom = '1. filtre xrefs, opérateur like, champs choisis'; Requete = "filterField=xrefs&op=like&value=$Cve&fields=$Champs&startOffset=0&endOffset=5" },
  @{ Nom = '2. filtre xrefs:CVE, opérateur eq, champs choisis'; Requete = "filterField=xrefs%3ACVE&op=eq&value=$Cve&fields=$Champs&startOffset=0&endOffset=5" },
  @{ Nom = '3. filtre xrefs, opérateur like, champs par défaut'; Requete = "filterField=xrefs&op=like&value=$Cve&startOffset=0&endOffset=5" }
)

function NomsDeChamps($Objet) {
  if ($Objet -is [System.Management.Automation.PSCustomObject]) { return (@($Objet.PSObject.Properties.Name) -join ', ') }
  return '(pas un objet)'
}

$Reussi = $false
foreach ($Essai in $Essais) {
  if ($Reussi) { break }
  [void]$Lignes.Add('')
  [void]$Lignes.Add("Essai $($Essai.Nom)")
  [void]$Lignes.Add("  GET /rest/plugin?$($Essai.Requete)")
  try {
    $Reponse = Invoke-RestMethod -Uri "$Base/rest/plugin?$($Essai.Requete)" -Method Get -Headers $Entetes @Direct
    [void]$Lignes.Add("  Réponse reçue. Champs de l'enveloppe : $(NomsDeChamps $Reponse)")
    if ($null -ne $Reponse.error_code) { [void]$Lignes.Add("  error_code : $($Reponse.error_code)") }
    $Liste = @($Reponse.response)
    [void]$Lignes.Add("  Nombre de contrôles rendus (cinq demandés au plus) : $($Liste.Count)")
    if ($Liste.Count -gt 0 -and $null -ne $Liste[0]) {
      [void]$Lignes.Add("  Champs d'un contrôle : $(NomsDeChamps $Liste[0])")
      foreach ($Controle in ($Liste | Select-Object -First 3)) {
        $Cite = [string]$Controle.xrefs -like "*$Cve*"
        [void]$Lignes.Add("  Contrôle $($Controle.id) | famille : $($Controle.family) | cite la CVE dans xrefs : $Cite | nom : $($Controle.name)")
        if ($null -ne $Controle.exploitFrameworks) { [void]$Lignes.Add("    exploitFrameworks : type $($Controle.exploitFrameworks.GetType().Name), $(@($Controle.exploitFrameworks).Count) élément(s)") }
      }
      $Reussi = $true
    }
  }
  catch {
    $Statut = $null
    if ($_.Exception.Response) { try { $Statut = [int]$_.Exception.Response.StatusCode } catch { $Statut = $null } }
    [void]$Lignes.Add("  ÉCHEC. Statut HTTP : $Statut")
    [void]$Lignes.Add("  Message : $($_.Exception.Message)")
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
      $Detail = [string]$_.ErrorDetails.Message
      if ($Detail.Length -gt 400) { $Detail = $Detail.Substring(0, 400) + '…' }
      [void]$Lignes.Add("  Détail rendu par Tenable : $Detail")
    }
  }
}
[void]$Lignes.Add('')
[void]$Lignes.Add($(if ($Reussi) { 'Conclusion : la recherche de contrôles par CVE répond.' } else { 'Conclusion : aucune des trois formes de requête n''a rendu de contrôle.' }))

$Secret = $null
$Lignes | Out-File -FilePath $Sortie -Encoding utf8
Write-Host ''
$Lignes | ForEach-Object { Write-Host $_ }
Write-Host ''
Write-Host "Fichier écrit : $Sortie"
Write-Host 'Relisez-le avant de le transmettre : il ne doit contenir que des noms de champs et des contrôles du catalogue de Tenable.'
Read-Host 'Appuyez sur Entrée pour fermer' | Out-Null
