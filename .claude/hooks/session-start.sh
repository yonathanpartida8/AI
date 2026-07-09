#!/bin/bash
# SessionStart hook — prepara el entorno en Claude Code on the web:
# instala las dependencias (esbuild) para que `npm run build` funcione.
set -euo pipefail

# Solo en el entorno remoto (Claude Code on the web)
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Idempotente: npm install aprovecha la caché del contenedor
npm install --no-fund --no-audit
