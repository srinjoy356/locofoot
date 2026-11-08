#!/usr/bin/env bash
# Runs the API test-suite against a throwaway LOCAL Supabase (Docker), never the hosted project.
# Rebuilds nothing by hand: `supabase start` applies supabase/migrations, so this also proves the migrations replay.
#   bash scripts/test-api-local.sh            # all tests
#   bash scripts/test-api-local.sh -k bracket # extra pytest args
# If another local Supabase already holds ports 54321/54322, change them in supabase/config.toml first.
set -euo pipefail
cd "$(dirname "$0")/.."

supabase status >/dev/null 2>&1 || supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,mailpit
eval "$(supabase status -o env | sed 's/^/L_/')"
strip() { local v="${!1}"; echo "${v//\"/}"; }

export SUPABASE_URL="$(strip L_API_URL)"
export SUPABASE_SERVICE_ROLE_KEY="$(strip L_SERVICE_ROLE_KEY)"
export SUPABASE_JWT_SECRET="$(strip L_JWT_SECRET)"
export NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$(strip L_ANON_KEY)"
export CLOUDINARY_CLOUD_NAME=local CLOUDINARY_API_KEY=local CLOUDINARY_API_SECRET=local

cd apps/api
if [ -x .venv/Scripts/python.exe ]; then PY=.venv/Scripts/python.exe; else PY=.venv/bin/python; fi
"$PY" -m pytest tests -q -p no:cacheprovider "$@"
