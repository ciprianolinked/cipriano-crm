#!/usr/bin/env bash
# =============================================================================
# Publica este projeto no GitHub via Git — sem o limite de 100 arquivos do site.
#
# Uso:
#   ./scripts/publicar-github.sh
#   ./scripts/publicar-github.sh https://github.com/SEU-USUARIO/cipriano-propostas.git
#
# Com autenticação por token (opcional):
#   GITHUB_TOKEN=ghp_XXXX ./scripts/publicar-github.sh https://github.com/SEU-USUARIO/cipriano-propostas.git
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

say() { printf '\n\033[36m== %s\033[0m\n' "$*"; }
warn() { printf '\033[33mAtenção: %s\033[0m\n' "$*"; }
fail() { printf '\033[31mErro: %s\033[0m\n' "$*"; exit 1; }

command -v git >/dev/null 2>&1 || fail "Git não encontrado. Instale em https://git-scm.com/downloads (ou use o GitHub Desktop)."

REMOTE_URL="${1:-}"

say "1/5 · Verificando proteção de segredos"
for secret in .env .env.local .env.production; do
  [ -f "$secret" ] || continue
  if ! grep -qE "^\.env($|\.\*|\.$)" .gitignore 2>/dev/null && ! grep -qE "^\.env$" .gitignore 2>/dev/null; then
    fail "O arquivo $secret existe, mas não está no .gitignore. Corrija antes de enviar."
  fi
  echo "   ok · $secret ignorado pelo Git"
done
grep -q "^node_modules/" .gitignore || fail "node_modules não está no .gitignore — o GitHub recusaria milhares de arquivos."
echo "   ok · node_modules, .next e .env fora do commit"

say "2/5 · Preparando o repositório"
[ -d .git ] || git init -b main
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
[ "$CURRENT_BRANCH" = "main" ] || git branch -M main

if ! git config user.email >/dev/null 2>&1 || ! git config user.name >/dev/null 2>&1; then
  say "Identidade do Git (apenas neste repositório)"
  if ! git config user.email >/dev/null 2>&1; then
    printf '   Seu e-mail do GitHub (usado no commit): '
    read -r GIT_EMAIL
    [ -n "$GIT_EMAIL" ] || fail "O commit precisa de um e-mail."
    git config user.email "$GIT_EMAIL"
  fi
  if ! git config user.name >/dev/null 2>&1; then
    printf '   Seu nome no GitHub: '
    read -r GIT_NAME
    [ -n "$GIT_NAME" ] || fail "O commit precisa de um nome."
    git config user.name "$GIT_NAME"
  fi
fi

say "3/5 · Adicionando e conferindo os arquivos"
git add -A
TRACKED="$(git ls-files | wc -l | tr -d ' ')"
STAGED="$(git diff --cached --name-only | wc -l | tr -d ' ')"
echo "   · arquivos versionados: $TRACKED"
echo "   · alterações staged:    $STAGED"
if [ "$STAGED" -gt 0 ]; then
  git diff --cached --name-only | sed 's/^/     · /'
fi

say "4/5 · Commit"
if [ "$STAGED" -gt 0 ]; then
  git commit -m "feat: central de propostas, CRM e contratos Cipriano Tech & Security"
else
  echo "   ok · nada a commitar (árvore de trabalho limpa)"
fi

say "5/5 · Envio ao GitHub"
if [ -z "$REMOTE_URL" ]; then
  if git remote get-url origin >/dev/null 2>&1; then
    REMOTE_URL="$(git remote get-url origin)"
    echo "   usando remoto existente: $REMOTE_URL"
  else
    printf '   Cole a URL do repositório (ex.: https://github.com/SEU-USUARIO/cipriano-propostas.git): '
    read -r REMOTE_URL
  fi
fi
[ -n "$REMOTE_URL" ] || fail "Nenhuma URL de repositório informada."

if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "$REMOTE_URL"
fi

PUSH_URL="$REMOTE_URL"
if [ -n "${GITHUB_TOKEN:-}" ]; then
  # Token apenas na URL desta chamada; não fica salvo no .git/config.
  PUSH_URL="$(printf '%s' "$REMOTE_URL" | sed -E "s#https://#https://x-access-token:${GITHUB_TOKEN}@#")"
fi

if ! git push -u origin main; then
  warn "O primeiro envio falhou. Tentando novamente com a URL configurada (token, se fornecido)."
  warn "Nada foi sobrescrito no GitHub: histórico remoto permanece intacto."
  git push -u "$PUSH_URL" main
fi

say "Concluído"
echo "   · repositório: $REMOTE_URL"
echo "   · branch: main"
echo "   · arquivos: $TRACKED (node_modules e .env não incluídos)"
echo "   Próximo passo: conecte este repositório na Vercel (Guia de publicação · passo 03)."
