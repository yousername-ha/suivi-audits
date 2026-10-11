"""Les étapes JSON sont partagées avec le serveur ; générer leur bundle navigateur."""
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
steps=json.loads((root/'sources/journey-steps.json').read_text(encoding='utf-8'))
(root/'modules/journey-steps.js').write_text('/* Généré depuis sources/journey-steps.json. */\nwindow.LegacyJourneySteps = '+json.dumps(steps,ensure_ascii=False)+';\n',encoding='utf-8')
