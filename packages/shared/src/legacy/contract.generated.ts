// Fichier généré par scripts/gen-contract.mjs depuis docs/legacy/LEGACY-FORMAT.md — ne pas modifier à la main.
export const CONTRACT_PATHS: ReadonlyArray<{ path: string; types: string }> = [
  {
    "path": "$.v",
    "types": "entier"
  },
  {
    "path": "$.updatedAt",
    "types": "entier"
  },
  {
    "path": "$.years",
    "types": "liste"
  },
  {
    "path": "$.years[]",
    "types": "entier"
  },
  {
    "path": "$.yearLabels",
    "types": "objet (dictionnaire indexé)"
  },
  {
    "path": "$.yearLabels.{clé}",
    "types": "texte"
  },
  {
    "path": "$.nextYear",
    "types": "entier"
  },
  {
    "path": "$.nextDate",
    "types": "texte"
  },
  {
    "path": "$.internalDate",
    "types": "texte"
  },
  {
    "path": "$.groups",
    "types": "liste"
  },
  {
    "path": "$.groups[]",
    "types": "objet"
  },
  {
    "path": "$.groups[].id",
    "types": "texte"
  },
  {
    "path": "$.groups[].ref",
    "types": "texte"
  },
  {
    "path": "$.groups[].num",
    "types": "texte"
  },
  {
    "path": "$.groups[].title",
    "types": "texte"
  },
  {
    "path": "$.items",
    "types": "liste"
  },
  {
    "path": "$.items[]",
    "types": "objet"
  },
  {
    "path": "$.items[].id",
    "types": "texte"
  },
  {
    "path": "$.items[].ref",
    "types": "texte"
  },
  {
    "path": "$.items[].num",
    "types": "texte"
  },
  {
    "path": "$.items[].title",
    "types": "texte"
  },
  {
    "path": "$.items[].group",
    "types": "texte"
  },
  {
    "path": "$.items[].depth",
    "types": "entier"
  },
  {
    "path": "$.items[].afnor",
    "types": "objet"
  },
  {
    "path": "$.items[].afnor.2025",
    "types": "texte"
  },
  {
    "path": "$.items[].afnor.2026",
    "types": "texte"
  },
  {
    "path": "$.items[].afnor.2027",
    "types": "texte"
  },
  {
    "path": "$.items[].interne",
    "types": "objet"
  },
  {
    "path": "$.items[].interne.2025",
    "types": "texte"
  },
  {
    "path": "$.items[].interne.2026",
    "types": "texte"
  },
  {
    "path": "$.items[].interne.2027",
    "types": "texte"
  },
  {
    "path": "$.items[].prep",
    "types": "texte"
  },
  {
    "path": "$.items[].owner",
    "types": "texte"
  },
  {
    "path": "$.items[].notes",
    "types": "texte"
  },
  {
    "path": "$.items[].remInterne",
    "types": "texte"
  },
  {
    "path": "$.items[].remAfnor",
    "types": "texte"
  },
  {
    "path": "$.findings",
    "types": "liste"
  },
  {
    "path": "$.findings[]",
    "types": "objet"
  },
  {
    "path": "$.findings[].id",
    "types": "texte"
  },
  {
    "path": "$.findings[].source",
    "types": "texte"
  },
  {
    "path": "$.findings[].year",
    "types": "entier"
  },
  {
    "path": "$.findings[].type",
    "types": "texte"
  },
  {
    "path": "$.findings[].status",
    "types": "texte"
  },
  {
    "path": "$.findings[].text",
    "types": "texte"
  },
  {
    "path": "$.findings[].desc",
    "types": "texte"
  },
  {
    "path": "$.findings[].action",
    "types": "texte"
  },
  {
    "path": "$.findings[].tasks",
    "types": "liste"
  },
  {
    "path": "$.findings[].tasks[]",
    "types": "objet"
  },
  {
    "path": "$.findings[].tasks[].t",
    "types": "texte"
  },
  {
    "path": "$.findings[].tasks[].done",
    "types": "booléen"
  },
  {
    "path": "$.findings[].comment",
    "types": "texte"
  },
  {
    "path": "$.findings[].items",
    "types": "liste"
  },
  {
    "path": "$.findings[].items[]",
    "types": "texte"
  },
  {
    "path": "$.findings[].owner",
    "types": "texte"
  },
  {
    "path": "$.findings[].due",
    "types": "texte"
  },
  {
    "path": "$.findings[].proof",
    "types": "texte"
  },
  {
    "path": "$.source",
    "types": "texte"
  },
  {
    "path": "$.closeDeadline",
    "types": "texte"
  },
  {
    "path": "$.findingsRev",
    "types": "entier"
  },
  {
    "path": "$.dda",
    "types": "objet (dictionnaire indexé)"
  },
  {
    "path": "$.dda.{clé}",
    "types": "objet"
  },
  {
    "path": "$.dda.{clé}.app",
    "types": "texte"
  },
  {
    "path": "$.dda.{clé}.just",
    "types": "texte"
  },
  {
    "path": "$.dda.{clé}.risk",
    "types": "texte"
  },
  {
    "path": "$.dda.{clé}.level",
    "types": "texte"
  },
  {
    "path": "$.dda.{clé}.actions",
    "types": "texte"
  },
  {
    "path": "$.dda.{clé}.docs",
    "types": "texte"
  },
  {
    "path": "$.dda.{clé}.comment",
    "types": "texte"
  },
  {
    "path": "$.dda.{clé}.obj",
    "types": "texte"
  },
  {
    "path": "$.dda.{clé}.req",
    "types": "texte"
  },
  {
    "path": "$.dda.{clé}.url",
    "types": "texte"
  },
  {
    "path": "$.processes",
    "types": "liste"
  },
  {
    "path": "$.processes[]",
    "types": "objet"
  },
  {
    "path": "$.processes[].id",
    "types": "texte"
  },
  {
    "path": "$.processes[].name",
    "types": "texte"
  },
  {
    "path": "$.processes[].owner",
    "types": "texte"
  },
  {
    "path": "$.processes[].family",
    "types": "texte"
  },
  {
    "path": "$.processes[].indicators",
    "types": "liste"
  },
  {
    "path": "$.processes[].parent",
    "types": "texte"
  },
  {
    "path": "$.objectives",
    "types": "liste"
  },
  {
    "path": "$.objectives[]",
    "types": "objet"
  },
  {
    "path": "$.objectives[].id",
    "types": "texte"
  },
  {
    "path": "$.objectives[].name",
    "types": "texte"
  },
  {
    "path": "$.objectives[].due",
    "types": "texte"
  },
  {
    "path": "$.objectives[].owner",
    "types": "texte"
  },
  {
    "path": "$.objectives[].processes",
    "types": "liste"
  },
  {
    "path": "$.objectives[].processes[]",
    "types": "texte"
  },
  {
    "path": "$.objectives[].enjeux",
    "types": "liste"
  },
  {
    "path": "$.objectives[].enjeux[]",
    "types": "texte"
  },
  {
    "path": "$.indicators",
    "types": "liste"
  },
  {
    "path": "$.indicators[]",
    "types": "objet"
  },
  {
    "path": "$.indicators[].id",
    "types": "texte"
  },
  {
    "path": "$.indicators[].name",
    "types": "texte"
  },
  {
    "path": "$.indicators[].obj",
    "types": "texte"
  },
  {
    "path": "$.indicators[].target",
    "types": "entier, nombre, texte"
  },
  {
    "path": "$.indicators[].action",
    "types": "texte"
  },
  {
    "path": "$.indicators[].lastReview",
    "types": "texte"
  },
  {
    "path": "$.indicators[].due",
    "types": "texte"
  },
  {
    "path": "$.indicators[].owner",
    "types": "texte"
  },
  {
    "path": "$.indicators[].values",
    "types": "liste"
  },
  {
    "path": "$.indicators[].values[]",
    "types": "objet"
  },
  {
    "path": "$.indicators[].values[].date",
    "types": "texte"
  },
  {
    "path": "$.indicators[].values[].v",
    "types": "entier, nombre, texte"
  },
  {
    "path": "$.indicators[].values[].note",
    "types": "texte"
  },
  {
    "path": "$.indicators[].values[].hist",
    "types": "texte"
  },
  {
    "path": "$.indicators[].dir",
    "types": "texte"
  },
  {
    "path": "$.indicators[].freq",
    "types": "texte"
  },
  {
    "path": "$.indicators[].calc",
    "types": "texte"
  },
  {
    "path": "$.indicators[].auto",
    "types": "booléen"
  },
  {
    "path": "$.indicators[].actionOwner",
    "types": "texte"
  },
  {
    "path": "$.indicators[].actionDue",
    "types": "texte"
  },
  {
    "path": "$.suppliers",
    "types": "liste"
  },
  {
    "path": "$.suppliers[]",
    "types": "objet"
  },
  {
    "path": "$.suppliers[].id",
    "types": "texte"
  },
  {
    "path": "$.suppliers[].name",
    "types": "texte"
  },
  {
    "path": "$.suppliers[].rattachement",
    "types": "texte"
  },
  {
    "path": "$.suppliers[].saas",
    "types": "booléen"
  },
  {
    "path": "$.suppliers[].sso",
    "types": "texte"
  },
  {
    "path": "$.suppliers[].mfa",
    "types": "texte"
  },
  {
    "path": "$.suppliers[].critical",
    "types": "texte"
  },
  {
    "path": "$.suppliers[].hds",
    "types": "texte"
  },
  {
    "path": "$.suppliers[].contact",
    "types": "texte"
  },
  {
    "path": "$.suppliers[].lastReview",
    "types": "texte"
  },
  {
    "path": "$.suppliers[].notes",
    "types": "texte"
  },
  {
    "path": "$.suppliers[].controls",
    "types": "liste"
  },
  {
    "path": "$.suppliers[].controls[]",
    "types": "objet"
  },
  {
    "path": "$.suppliers[].controls[].id",
    "types": "texte"
  },
  {
    "path": "$.suppliers[].controls[].t",
    "types": "texte"
  },
  {
    "path": "$.suppliers[].controls[].ref",
    "types": "texte"
  },
  {
    "path": "$.suppliers[].controls[].freq",
    "types": "entier"
  },
  {
    "path": "$.suppliers[].controls[].last",
    "types": "texte"
  },
  {
    "path": "$.suppliers[].controls[].result",
    "types": "texte"
  },
  {
    "path": "$.suppliers[].controls[].comment",
    "types": "texte"
  },
  {
    "path": "$.suppliers[].certs",
    "types": "liste"
  },
  {
    "path": "$.suppliers[].createdAt",
    "types": "texte"
  },
  {
    "path": "$.suppliers[].controls[].createdAt",
    "types": "texte"
  },
  {
    "path": "$.frameworks",
    "types": "liste"
  },
  {
    "path": "$.frameworks[]",
    "types": "objet"
  },
  {
    "path": "$.frameworks[].id",
    "types": "texte"
  },
  {
    "path": "$.frameworks[].name",
    "types": "texte"
  },
  {
    "path": "$.frameworks[].version",
    "types": "texte"
  },
  {
    "path": "$.frameworks[].source",
    "types": "texte"
  },
  {
    "path": "$.frameworks[].scopeMode",
    "types": "texte"
  },
  {
    "path": "$.frameworks[].requirements",
    "types": "liste"
  },
  {
    "path": "$.frameworks[].requirements[]",
    "types": "objet"
  },
  {
    "path": "$.frameworks[].requirements[].id",
    "types": "texte"
  },
  {
    "path": "$.frameworks[].requirements[].os",
    "types": "entier"
  },
  {
    "path": "$.frameworks[].requirements[].objective",
    "types": "texte"
  },
  {
    "path": "$.frameworks[].requirements[].theme",
    "types": "texte"
  },
  {
    "path": "$.frameworks[].requirements[].scope",
    "types": "texte"
  },
  {
    "path": "$.frameworks[].requirements[].text",
    "types": "texte"
  },
  {
    "path": "$.frameworks[].requirements[].maps",
    "types": "liste"
  },
  {
    "path": "$.frameworks[].requirements[].self",
    "types": "texte"
  },
  {
    "path": "$.frameworks[].requirements[].comment",
    "types": "texte"
  },
  {
    "path": "$.frameworks[].objectives",
    "types": "objet (dictionnaire indexé)"
  },
  {
    "path": "$.frameworks[].objectives.{clé}",
    "types": "objet"
  },
  {
    "path": "$.frameworks[].objectives.{clé}.title",
    "types": "texte"
  },
  {
    "path": "$.frameworks[].objectives.{clé}.statement",
    "types": "texte"
  },
  {
    "path": "$.frameworks[].objectives.{clé}.prevaloir",
    "types": "liste"
  },
  {
    "path": "$.frameworks[].objectives.{clé}.iso",
    "types": "booléen"
  },
  {
    "path": "$.frameworks[].objectives.{clé}.qualified",
    "types": "liste"
  },
  {
    "path": "$.frameworks[].objectives.{clé}.nis2",
    "types": "liste"
  },
  {
    "path": "$.frameworks[].objectives.{clé}.nis2[]",
    "types": "texte"
  },
  {
    "path": "$.frameworks[].objectives.{clé}.pillar",
    "types": "texte"
  },
  {
    "path": "$.frameworks[].objectives.{clé}.prevaloir[]",
    "types": "texte"
  },
  {
    "path": "$.frameworks[].objectives.{clé}.qualified[]",
    "types": "texte"
  },
  {
    "path": "$.ai",
    "types": "objet"
  },
  {
    "path": "$.ai.context",
    "types": "texte"
  },
  {
    "path": "$.ai.register",
    "types": "liste"
  },
  {
    "path": "$.ai.register[]",
    "types": "objet"
  },
  {
    "path": "$.ai.register[].id",
    "types": "texte"
  },
  {
    "path": "$.ai.register[].usecase",
    "types": "texte"
  },
  {
    "path": "$.ai.register[].owner",
    "types": "texte"
  },
  {
    "path": "$.ai.register[].role",
    "types": "texte"
  },
  {
    "path": "$.ai.register[].type",
    "types": "texte"
  },
  {
    "path": "$.ai.register[].provider",
    "types": "texte"
  },
  {
    "path": "$.ai.register[].purpose",
    "types": "texte"
  },
  {
    "path": "$.ai.register[].dscp",
    "types": "texte"
  },
  {
    "path": "$.ai.register[].data",
    "types": "texte"
  },
  {
    "path": "$.ai.register[].hdsAct",
    "types": "texte"
  },
  {
    "path": "$.ai.register[].hdsCert",
    "types": "texte"
  },
  {
    "path": "$.ai.register[].storage",
    "types": "texte"
  },
  {
    "path": "$.ai.register[].remote",
    "types": "texte"
  },
  {
    "path": "$.ai.register[].training",
    "types": "texte"
  },
  {
    "path": "$.ai.register[].aiact",
    "types": "texte"
  },
  {
    "path": "$.ai.register[].dm",
    "types": "texte"
  },
  {
    "path": "$.ai.register[].human",
    "types": "texte"
  },
  {
    "path": "$.ai.register[].aipd",
    "types": "texte"
  },
  {
    "path": "$.ai.register[].authz",
    "types": "texte"
  },
  {
    "path": "$.ai.register[].golive",
    "types": "texte"
  },
  {
    "path": "$.ai.register[].proof",
    "types": "texte"
  },
  {
    "path": "$.ai.register[].category",
    "types": "texte"
  },
  {
    "path": "$.ai.register[].aiPresence",
    "types": "texte"
  },
  {
    "path": "$.ai.evals",
    "types": "liste"
  },
  {
    "path": "$.ai.evals[]",
    "types": "objet"
  },
  {
    "path": "$.ai.evals[].id",
    "types": "texte"
  },
  {
    "path": "$.ai.evals[].domain",
    "types": "texte"
  },
  {
    "path": "$.ai.evals[].scenario",
    "types": "texte"
  },
  {
    "path": "$.ai.evals[].app",
    "types": "texte"
  },
  {
    "path": "$.ai.evals[].dscp",
    "types": "texte"
  },
  {
    "path": "$.ai.evals[].c",
    "types": "entier"
  },
  {
    "path": "$.ai.evals[].i",
    "types": "entier"
  },
  {
    "path": "$.ai.evals[].a",
    "types": "entier"
  },
  {
    "path": "$.ai.evals[].audit",
    "types": "entier"
  },
  {
    "path": "$.ai.evals[].patient",
    "types": "entier"
  },
  {
    "path": "$.ai.evals[].prob",
    "types": "entier"
  },
  {
    "path": "$.ai.evals[].maturity",
    "types": "entier"
  },
  {
    "path": "$.ai.evals[].effort",
    "types": "entier"
  },
  {
    "path": "$.ai.evals[].iso",
    "types": "texte"
  },
  {
    "path": "$.ai.evals[].hds",
    "types": "texte"
  },
  {
    "path": "$.ai.evals[].measure",
    "types": "texte"
  },
  {
    "path": "$.ai.evals[].scope",
    "types": "texte"
  },
  {
    "path": "$.ai.evals[].status",
    "types": "texte"
  },
  {
    "path": "$.ai.plan",
    "types": "liste"
  },
  {
    "path": "$.ai.plan[]",
    "types": "objet"
  },
  {
    "path": "$.ai.plan[].step",
    "types": "entier"
  },
  {
    "path": "$.ai.plan[].phase",
    "types": "texte"
  },
  {
    "path": "$.ai.plan[].action",
    "types": "texte"
  },
  {
    "path": "$.ai.plan[].result",
    "types": "texte"
  },
  {
    "path": "$.ai.plan[].owner",
    "types": "texte"
  },
  {
    "path": "$.ai.plan[].contrib",
    "types": "texte"
  },
  {
    "path": "$.ai.plan[].iso",
    "types": "texte"
  },
  {
    "path": "$.ai.plan[].hds",
    "types": "texte"
  },
  {
    "path": "$.ai.plan[].proof",
    "types": "texte"
  },
  {
    "path": "$.ai.plan[].kpi",
    "types": "texte"
  },
  {
    "path": "$.ai.plan[].jStart",
    "types": "entier"
  },
  {
    "path": "$.ai.plan[].jEnd",
    "types": "entier"
  },
  {
    "path": "$.ai.plan[].priority",
    "types": "texte"
  },
  {
    "path": "$.ai.plan[].status",
    "types": "texte"
  },
  {
    "path": "$.ai.plan[].progress",
    "types": "entier"
  },
  {
    "path": "$.ai.plan[].dep",
    "types": "texte"
  },
  {
    "path": "$.ai.plan[].evals",
    "types": "texte"
  },
  {
    "path": "$.ai.policies",
    "types": "liste"
  },
  {
    "path": "$.ai.policies[]",
    "types": "objet"
  },
  {
    "path": "$.ai.policies[].policy",
    "types": "texte"
  },
  {
    "path": "$.ai.policies[].impact",
    "types": "texte"
  },
  {
    "path": "$.ai.policies[].change",
    "types": "texte"
  },
  {
    "path": "$.ai.policies[].iso",
    "types": "texte"
  },
  {
    "path": "$.ai.policies[].annex",
    "types": "texte"
  },
  {
    "path": "$.ai.policies[].hds",
    "types": "texte"
  },
  {
    "path": "$.ai.policies[].evals",
    "types": "texte"
  },
  {
    "path": "$.ai.policies[].steps",
    "types": "texte"
  },
  {
    "path": "$.ai.policies[].owner",
    "types": "texte"
  },
  {
    "path": "$.ai.policies[].target",
    "types": "texte"
  },
  {
    "path": "$.ai.policies[].freq",
    "types": "texte"
  },
  {
    "path": "$.ai.policies[].proof",
    "types": "texte"
  },
  {
    "path": "$.ai.policies[].status",
    "types": "texte"
  },
  {
    "path": "$.ai.start",
    "types": "texte"
  },
  {
    "path": "$.ai.sources",
    "types": "liste"
  },
  {
    "path": "$.ai.sources[]",
    "types": "objet"
  },
  {
    "path": "$.ai.sources[].id",
    "types": "texte"
  },
  {
    "path": "$.ai.sources[].name",
    "types": "texte"
  },
  {
    "path": "$.ai.sources[].version",
    "types": "texte"
  },
  {
    "path": "$.ai.sources[].use",
    "types": "texte"
  },
  {
    "path": "$.ai.sources[].url",
    "types": "texte"
  },
  {
    "path": "$.ai.sources[].checked",
    "types": "texte"
  },
  {
    "path": "$.ai.sources[].note",
    "types": "texte"
  },
  {
    "path": "$.ai.startValidated",
    "types": "booléen"
  },
  {
    "path": "$.activeFw",
    "types": "texte"
  },
  {
    "path": "$.entityCategory",
    "types": "texte"
  },
  {
    "path": "$.schema",
    "types": "entier"
  },
  {
    "path": "$.iso27001Certified",
    "types": "booléen"
  },
  {
    "path": "$.accessReviews",
    "types": "liste"
  },
  {
    "path": "$.accessReviews[]",
    "types": "objet"
  },
  {
    "path": "$.accessReviews[].id",
    "types": "texte"
  },
  {
    "path": "$.accessReviews[].app",
    "types": "texte"
  },
  {
    "path": "$.accessReviews[].month",
    "types": "texte"
  },
  {
    "path": "$.accessReviews[].supplier",
    "types": "texte"
  },
  {
    "path": "$.accessReviews[].freq",
    "types": "entier"
  },
  {
    "path": "$.accessReviews[].source",
    "types": "texte"
  },
  {
    "path": "$.accessReviews[].comment",
    "types": "texte"
  },
  {
    "path": "$.plan",
    "types": "objet"
  },
  {
    "path": "$.plan.status",
    "types": "texte"
  },
  {
    "path": "$.plan.note",
    "types": "texte"
  },
  {
    "path": "$.plan.days",
    "types": "liste"
  },
  {
    "path": "$.plan.days[]",
    "types": "objet"
  },
  {
    "path": "$.plan.days[].id",
    "types": "texte"
  },
  {
    "path": "$.plan.days[].label",
    "types": "texte"
  },
  {
    "path": "$.plan.days[].date",
    "types": "texte"
  },
  {
    "path": "$.plan.slots",
    "types": "liste"
  },
  {
    "path": "$.plan.slots[]",
    "types": "objet"
  },
  {
    "path": "$.plan.slots[].id",
    "types": "texte"
  },
  {
    "path": "$.plan.slots[].day",
    "types": "texte"
  },
  {
    "path": "$.plan.slots[].start",
    "types": "texte"
  },
  {
    "path": "$.plan.slots[].end",
    "types": "texte"
  },
  {
    "path": "$.plan.slots[].type",
    "types": "texte"
  },
  {
    "path": "$.plan.slots[].title",
    "types": "texte"
  },
  {
    "path": "$.plan.slots[].detail",
    "types": "texte"
  },
  {
    "path": "$.plan.slots[].place",
    "types": "texte"
  },
  {
    "path": "$.plan.slots[].items",
    "types": "liste"
  },
  {
    "path": "$.plan.slots[].people",
    "types": "liste"
  },
  {
    "path": "$.plan.slots[].people[]",
    "types": "texte"
  },
  {
    "path": "$.plan.slots[].proofs",
    "types": "liste"
  },
  {
    "path": "$.plan.slots[].questions",
    "types": "liste"
  },
  {
    "path": "$.plan.slots[].items[]",
    "types": "texte"
  },
  {
    "path": "$.plan.slots[].proofs[]",
    "types": "objet"
  },
  {
    "path": "$.plan.slots[].proofs[].t",
    "types": "texte"
  },
  {
    "path": "$.plan.slots[].proofs[].done",
    "types": "booléen"
  },
  {
    "path": "$.plan.slots[].questions[]",
    "types": "texte"
  },
  {
    "path": "$.plan.people",
    "types": "liste"
  },
  {
    "path": "$.plan.people[]",
    "types": "objet"
  },
  {
    "path": "$.plan.people[].id",
    "types": "texte"
  },
  {
    "path": "$.plan.people[].name",
    "types": "texte"
  },
  {
    "path": "$.plan.people[].role",
    "types": "texte"
  },
  {
    "path": "$.appGaps",
    "types": "liste"
  },
  {
    "path": "$.appGaps[]",
    "types": "objet"
  },
  {
    "path": "$.appGaps[].id",
    "types": "texte"
  },
  {
    "path": "$.appGaps[].createdAt",
    "types": "texte"
  },
  {
    "path": "$.appGaps[].name",
    "types": "texte"
  },
  {
    "path": "$.appGaps[].supplier",
    "types": "texte"
  },
  {
    "path": "$.appGaps[].dscp",
    "types": "texte"
  },
  {
    "path": "$.appGaps[].cloud",
    "types": "texte"
  },
  {
    "path": "$.appGaps[].status",
    "types": "texte"
  },
  {
    "path": "$.appGaps[].owner",
    "types": "texte"
  },
  {
    "path": "$.appGaps[].target",
    "types": "texte"
  },
  {
    "path": "$.appGaps[].desc",
    "types": "texte"
  },
  {
    "path": "$.appGaps[].lines",
    "types": "objet"
  },
  {
    "path": "$.appGaps[].custom",
    "types": "liste"
  },
  {
    "path": "$.reviews",
    "types": "liste"
  },
  {
    "path": "$.reviews[]",
    "types": "objet"
  },
  {
    "path": "$.reviews[].id",
    "types": "texte"
  },
  {
    "path": "$.reviews[].type",
    "types": "texte"
  },
  {
    "path": "$.reviews[].createdAt",
    "types": "texte"
  },
  {
    "path": "$.reviews[].date",
    "types": "texte"
  },
  {
    "path": "$.reviews[].title",
    "types": "texte"
  },
  {
    "path": "$.reviews[].period",
    "types": "texte"
  },
  {
    "path": "$.reviews[].participants",
    "types": "texte"
  },
  {
    "path": "$.reviews[].classification",
    "types": "texte"
  },
  {
    "path": "$.reviews[].sections",
    "types": "liste"
  },
  {
    "path": "$.reviews[].sections[]",
    "types": "texte"
  },
  {
    "path": "$.reviews[].inputs",
    "types": "objet"
  },
  {
    "path": "$.reviews[].decisions",
    "types": "liste"
  },
  {
    "path": "$.reviews[].cs",
    "types": "objet"
  },
  {
    "path": "$.reviews[].cs.inc",
    "types": "objet"
  },
  {
    "path": "$.reviews[].cs.inc.open",
    "types": "texte"
  },
  {
    "path": "$.reviews[].cs.inc.closed",
    "types": "texte"
  },
  {
    "path": "$.reviews[].cs.inc.total",
    "types": "texte"
  },
  {
    "path": "$.reviews[].cs.inc.focus",
    "types": "liste"
  },
  {
    "path": "$.reviews[].cs.inc.focus[]",
    "types": "objet"
  },
  {
    "path": "$.reviews[].cs.inc.focus[].name",
    "types": "texte"
  },
  {
    "path": "$.reviews[].cs.inc.focus[].date",
    "types": "texte"
  },
  {
    "path": "$.reviews[].cs.inc.focus[].time",
    "types": "texte"
  },
  {
    "path": "$.reviews[].cs.inc.focus[].desc",
    "types": "texte"
  },
  {
    "path": "$.reviews[].cs.vul",
    "types": "objet"
  },
  {
    "path": "$.reviews[].cs.vul.tenable",
    "types": "objet"
  },
  {
    "path": "$.reviews[].cs.vul.tenable.kpi",
    "types": "texte"
  },
  {
    "path": "$.reviews[].cs.vul.tenable.txt",
    "types": "texte"
  },
  {
    "path": "$.reviews[].cs.vul.tenable.img",
    "types": "null"
  },
  {
    "path": "$.reviews[].cs.vul.ext",
    "types": "objet"
  },
  {
    "path": "$.reviews[].cs.vul.ext.kpi",
    "types": "texte"
  },
  {
    "path": "$.reviews[].cs.vul.ext.txt",
    "types": "texte"
  },
  {
    "path": "$.reviews[].cs.vul.ext.img",
    "types": "null"
  },
  {
    "path": "$.reviews[].cs.vul.def",
    "types": "objet"
  },
  {
    "path": "$.reviews[].cs.vul.def.kpi",
    "types": "texte"
  },
  {
    "path": "$.reviews[].cs.vul.def.txt",
    "types": "texte"
  },
  {
    "path": "$.reviews[].cs.vul.def.img",
    "types": "null"
  },
  {
    "path": "$.reviews[].cs.rc",
    "types": "objet"
  },
  {
    "path": "$.reviews[].cs.rc.cont",
    "types": "objet"
  },
  {
    "path": "$.reviews[].cs.rc.cont.kpi",
    "types": "texte"
  },
  {
    "path": "$.reviews[].cs.rc.cont.txt",
    "types": "texte"
  },
  {
    "path": "$.reviews[].cs.rc.cont.img",
    "types": "null"
  },
  {
    "path": "$.reviews[].cs.rc.dispo",
    "types": "objet"
  },
  {
    "path": "$.reviews[].cs.rc.dispo.kpi",
    "types": "texte"
  },
  {
    "path": "$.reviews[].cs.rc.dispo.txt",
    "types": "texte"
  },
  {
    "path": "$.reviews[].cs.rc.dispo.img",
    "types": "null"
  },
  {
    "path": "$.reviews[].cs.rc.sensi",
    "types": "objet"
  },
  {
    "path": "$.reviews[].cs.rc.sensi.kpi",
    "types": "texte"
  },
  {
    "path": "$.reviews[].cs.rc.sensi.txt",
    "types": "texte"
  },
  {
    "path": "$.reviews[].cs.rc.sensi.img",
    "types": "null"
  },
  {
    "path": "$.reviews[].cs.rc.acces",
    "types": "booléen"
  },
  {
    "path": "$.reviews[].cs.risks",
    "types": "liste"
  },
  {
    "path": "$.reviews[].cs.withEcarts",
    "types": "booléen"
  },
  {
    "path": "$.reviews[].cs.nr",
    "types": "objet"
  },
  {
    "path": "$.reviews[].cs.nr.chg",
    "types": "texte"
  },
  {
    "path": "$.reviews[].cs.nr.vul",
    "types": "texte"
  },
  {
    "path": "$.reviews[].cs.nr.inc",
    "types": "texte"
  },
  {
    "path": "$.reviews[].cs.nr.nc",
    "types": "texte"
  },
  {
    "path": "$.reviews[].cs.sujet",
    "types": "liste"
  },
  {
    "path": "$.reviews[].cs.sujet[]",
    "types": "objet"
  },
  {
    "path": "$.reviews[].cs.sujet[].title",
    "types": "texte"
  },
  {
    "path": "$.reviews[].cs.sujet[].txt",
    "types": "texte"
  },
  {
    "path": "$.reviews[].cs.sujet[].img",
    "types": "null"
  },
  {
    "path": "$.reviews[].cs.rem",
    "types": "texte"
  },
  {
    "path": "$.branding",
    "types": "objet"
  },
  {
    "path": "$.plans",
    "types": "liste"
  },
  {
    "path": "$.scope",
    "types": "objet"
  },
  {
    "path": "$.scope.hds",
    "types": "liste"
  },
  {
    "path": "$.scope.excl",
    "types": "liste"
  },
  {
    "path": "$.scope.processes",
    "types": "liste"
  },
  {
    "path": "$.interested",
    "types": "liste"
  },
  {
    "path": "$.swots",
    "types": "liste"
  },
  {
    "path": "$.swots[]",
    "types": "objet"
  },
  {
    "path": "$.swots[].id",
    "types": "texte"
  },
  {
    "path": "$.swots[].createdAt",
    "types": "texte"
  },
  {
    "path": "$.swots[].process",
    "types": "texte"
  },
  {
    "path": "$.swots[].date",
    "types": "texte"
  },
  {
    "path": "$.swots[].author",
    "types": "texte"
  },
  {
    "path": "$.swots[].version",
    "types": "texte"
  },
  {
    "path": "$.swots[].S",
    "types": "liste"
  },
  {
    "path": "$.swots[].W",
    "types": "liste"
  },
  {
    "path": "$.swots[].O",
    "types": "liste"
  },
  {
    "path": "$.swots[].T",
    "types": "liste"
  },
  {
    "path": "$.incidents",
    "types": "liste"
  },
  {
    "path": "$.supEvals",
    "types": "liste"
  },
  {
    "path": "$.crisis",
    "types": "objet"
  },
  {
    "path": "$.crisis.contacts",
    "types": "liste"
  },
  {
    "path": "$.crisis.scenarios",
    "types": "liste"
  },
  {
    "path": "$.crisis.cells",
    "types": "liste"
  },
  {
    "path": "$.crisis.cells[]",
    "types": "objet"
  },
  {
    "path": "$.crisis.cells[].id",
    "types": "texte"
  },
  {
    "path": "$.crisis.cells[].createdAt",
    "types": "texte"
  },
  {
    "path": "$.crisis.cells[].title",
    "types": "texte"
  },
  {
    "path": "$.crisis.cells[].mode",
    "types": "texte"
  },
  {
    "path": "$.crisis.cells[].scenario",
    "types": "texte"
  },
  {
    "path": "$.crisis.cells[].plan",
    "types": "texte"
  },
  {
    "path": "$.crisis.cells[].start",
    "types": "texte"
  },
  {
    "path": "$.crisis.cells[].end",
    "types": "texte"
  },
  {
    "path": "$.crisis.cells[].status",
    "types": "texte"
  },
  {
    "path": "$.crisis.cells[].log",
    "types": "liste"
  },
  {
    "path": "$.crisis.cells[].log[]",
    "types": "objet"
  },
  {
    "path": "$.crisis.cells[].log[].ts",
    "types": "texte"
  },
  {
    "path": "$.crisis.cells[].log[].type",
    "types": "texte"
  },
  {
    "path": "$.crisis.cells[].log[].author",
    "types": "texte"
  },
  {
    "path": "$.crisis.cells[].log[].text",
    "types": "texte"
  },
  {
    "path": "$.crisis.cells[].checks",
    "types": "objet"
  },
  {
    "path": "$.crisis.cells[].deadlines",
    "types": "liste"
  },
  {
    "path": "$.roles",
    "types": "liste"
  },
  {
    "path": "$.roles[]",
    "types": "objet"
  },
  {
    "path": "$.roles[].createdAt",
    "types": "texte"
  },
  {
    "path": "$.roles[].name",
    "types": "texte"
  },
  {
    "path": "$.roles[].holder",
    "types": "texte"
  },
  {
    "path": "$.roles[].deputy",
    "types": "texte"
  },
  {
    "path": "$.roles[].email",
    "types": "texte"
  },
  {
    "path": "$.roles[].phone",
    "types": "texte"
  },
  {
    "path": "$.roles[].resp",
    "types": "texte"
  },
  {
    "path": "$.roles[].refs",
    "types": "texte"
  },
  {
    "path": "$.recurring",
    "types": "liste"
  },
  {
    "path": "$.evidences",
    "types": "liste"
  },
  {
    "path": "$.invest",
    "types": "objet"
  },
  {
    "path": "$.invest.baseYear",
    "types": "entier"
  },
  {
    "path": "$.invest.lines",
    "types": "liste"
  },
  {
    "path": "$.invest.lines[]",
    "types": "objet"
  },
  {
    "path": "$.invest.lines[].id",
    "types": "texte"
  },
  {
    "path": "$.invest.lines[].createdAt",
    "types": "texte"
  },
  {
    "path": "$.invest.lines[].company",
    "types": "texte"
  },
  {
    "path": "$.invest.lines[].priority",
    "types": "texte"
  },
  {
    "path": "$.invest.lines[].type",
    "types": "texte"
  },
  {
    "path": "$.invest.lines[].desc",
    "types": "texte"
  },
  {
    "path": "$.invest.lines[].n0",
    "types": "entier, nombre"
  },
  {
    "path": "$.invest.lines[].n1",
    "types": "entier, nombre"
  },
  {
    "path": "$.invest.lines[].n2",
    "types": "entier, nombre"
  },
  {
    "path": "$.invest.lines[].comment",
    "types": "texte"
  },
  {
    "path": "$.invest.lines[].alt",
    "types": "texte"
  },
  {
    "path": "$.invest.lines[].account",
    "types": "texte"
  },
  {
    "path": "$.invest.lines[].perimeter",
    "types": "texte"
  },
  {
    "path": "$.invest.lines[].status",
    "types": "texte"
  },
  {
    "path": "$.invest.lines[].nature",
    "types": "texte"
  },
  {
    "path": "$.invest.lines[].renewal",
    "types": "texte"
  },
  {
    "path": "$.invest.lines[].notice",
    "types": "entier"
  },
  {
    "path": "$.invest.lines[].supplier",
    "types": "texte"
  },
  {
    "path": "$.invest.source",
    "types": "texte"
  },
  {
    "path": "$.crrc",
    "types": "objet"
  },
  {
    "path": "$.crrc.offers",
    "types": "liste"
  },
  {
    "path": "$.crrc.offers[]",
    "types": "objet"
  },
  {
    "path": "$.crrc.offers[].id",
    "types": "texte"
  },
  {
    "path": "$.crrc.offers[].name",
    "types": "texte"
  },
  {
    "path": "$.crrc.offers[].status",
    "types": "texte"
  },
  {
    "path": "$.crrc.offers[].partner",
    "types": "texte"
  },
  {
    "path": "$.crrc.offers[].desc",
    "types": "texte"
  },
  {
    "path": "$.crrc.offers[].perimeters",
    "types": "liste"
  },
  {
    "path": "$.crrc.offers[].perimeters[]",
    "types": "liste"
  },
  {
    "path": "$.crrc.offers[].perimeters[][]",
    "types": "texte, liste"
  },
  {
    "path": "$.crrc.offers[].perimeters[][][]",
    "types": "texte"
  },
  {
    "path": "$.crrc.establishments",
    "types": "liste"
  },
  {
    "path": "$.crrc.resources",
    "types": "liste"
  },
  {
    "path": "$.crrc.runs",
    "types": "liste"
  },
  {
    "path": "$.crrc.restores",
    "types": "liste"
  },
  {
    "path": "$.crrc.alerts",
    "types": "liste"
  }
];
