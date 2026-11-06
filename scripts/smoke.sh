#!/usr/bin/env bash
# End-to-end API check. Usage: BASE=http://127.0.0.1:5080 PUBLISHED_DIR=/data/published scripts/smoke.sh
# Needs a freshly created database (the first registered user becomes the administrator).
set -u
BASE=${BASE:-http://127.0.0.1:5080}
PUB=${PUBLISHED_DIR:-}
pass=0; fail=0
ok(){ pass=$((pass+1)); printf '  ok   %s\n' "$1"; }
bad(){ fail=$((fail+1)); printf '  FAIL %s (%s)\n' "$1" "${2:-}"; }
expect(){ [ "$2" = "$3" ] && ok "$1" || bad "$1" "got $2, wanted $3"; }
req(){ # method path token [json]
  local m=$1 p=$2 t=$3 d=${4:-}
  if [ -n "$d" ]; then curl -s -o /tmp/smoke.out -w '%{http_code}' -X "$m" "$BASE$p" -H "Authorization: Bearer $t" -H 'Content-Type: application/json' -d "$d"
  else curl -s -o /tmp/smoke.out -w '%{http_code}' -X "$m" "$BASE$p" -H "Authorization: Bearer $t"; fi; }
body(){ cat /tmp/smoke.out; }

DOC='{"name":"Demo","theme":{"primary":"#0f766e","bg":"#fff","text":"#111","font":"DM Sans","radius":8},"pages":[{"id":"p1","name":"Home","slug":"home","title":"","blocks":[{"id":"b1","type":"heading","p":{"text":"Hi","level":"1"},"s":{},"hidden":false,"trigger":"click","actions":[]}]}]}'

echo "auth"
expect "status before any user" "$(curl -s $BASE/api/auth/status | jq -r .hasUsers)" false
code=$(curl -s -o /tmp/smoke.out -w '%{http_code}' -X POST $BASE/api/auth/register -H 'Content-Type: application/json' -d '{"email":"admin@example.com","password":"short"}')
expect "weak password rejected" "$code" 400
code=$(curl -s -o /tmp/smoke.out -w '%{http_code}' -X POST $BASE/api/auth/register -H 'Content-Type: application/json' -d '{"email":"admin@example.com","password":"correct horse battery","displayName":"Ada"}')
expect "first user registers" "$code" 200
ADMIN=$(body | jq -r .token); expect "first user is admin" "$(body | jq -r .user.isAdmin)" true
code=$(curl -s -o /tmp/smoke.out -w '%{http_code}' -X POST $BASE/api/auth/register -H 'Content-Type: application/json' -d '{"email":"x@example.com","password":"correct horse battery"}')
expect "open sign-up is closed afterwards" "$code" 403
code=$(curl -s -o /tmp/smoke.out -w '%{http_code}' -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@example.com","password":"wrong wrong wrong"}')
expect "wrong password" "$code" 401
expect "no token" "$(curl -s -o /dev/null -w '%{http_code}' $BASE/api/sites)" 401

echo "users"
expect "admin creates editor" "$(req POST /api/users $ADMIN '{"email":"eve@example.com","password":"another long one","displayName":"Eve","isAdmin":false}')" 200
EVE_ID=$(body | jq -r .id)
code=$(curl -s -o /tmp/smoke.out -w '%{http_code}' -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"email":"eve@example.com","password":"another long one"}')
expect "editor logs in" "$code" 200; EVE=$(body | jq -r .token)
expect "editor cannot list users" "$(req GET /api/users $EVE)" 403

echo "sites"
expect "create site" "$(req POST /api/sites $ADMIN "{\"name\":\"Demo Site\",\"document\":$DOC}")" 200
SID=$(body | jq -r .id); expect "slug derived from name" "$(body | jq -r .slug)" demo-site
expect "second site gets a suffix" "$(req POST /api/sites $ADMIN '{"name":"Demo Site"}')" 200
expect "suffix applied" "$(body | jq -r .slug)" demo-site-2
expect "reserved slug refused" "$(req POST /api/sites $ADMIN '{"name":"x","slug":"api"}')" 400
expect "taken slug refused" "$(req POST /api/sites $ADMIN '{"name":"x","slug":"demo-site"}')" 409
expect "editor cannot see others' site" "$(req GET /api/sites/$SID $EVE)" 404
expect "editor list is empty" "$(req GET /api/sites $EVE >/dev/null; body | jq length)" 0

echo "members"
expect "owner adds editor" "$(req POST /api/sites/$SID/members $ADMIN '{"email":"eve@example.com","role":"editor"}')" 204
expect "editor can now open" "$(req GET /api/sites/$SID $EVE)" 200
expect "editor cannot delete" "$(req DELETE /api/sites/$SID $EVE)" 403
expect "editor cannot rename" "$(req PATCH /api/sites/$SID $EVE '{"name":"Hax"}')" 403
expect "editor cannot add members" "$(req POST /api/sites/$SID/members $EVE '{"email":"eve@example.com","role":"owner"}')" 403

echo "draft + concurrency"
V=$(req GET /api/sites/$SID $ADMIN >/dev/null; body | jq -r .version)
NEWDOC=$(echo "$DOC" | jq '.name="Demo v2"')
expect "save draft" "$(req PUT /api/sites/$SID/draft $ADMIN "{\"baseVersion\":$V,\"document\":$NEWDOC}")" 200
expect "stale save is a conflict" "$(req PUT /api/sites/$SID/draft $EVE "{\"baseVersion\":$V,\"document\":$NEWDOC}")" 409
V=$(req GET /api/sites/$SID $ADMIN >/dev/null; body | jq -r .version)
BADDOC=$(echo "$DOC" | jq '.pages[0].blocks[0].type="script"')
expect "unknown element type refused" "$(req PUT /api/sites/$SID/draft $ADMIN "{\"baseVersion\":$V,\"document\":$BADDOC}")" 400
DUP=$(echo "$DOC" | jq '.pages += [.pages[0]]')
expect "duplicate pages refused" "$(req PUT /api/sites/$SID/draft $ADMIN "{\"baseVersion\":$V,\"document\":$DUP}")" 400

echo "publish"
HTML='<!doctype html><html><body>hello</body></html>'
expect "stale publish refused" "$(req POST /api/sites/$SID/publish $ADMIN "{\"baseVersion\":1,\"html\":\"$HTML\"}")" 409
expect "non-html refused" "$(req POST /api/sites/$SID/publish $ADMIN "{\"baseVersion\":$V,\"html\":\"nope\"}")" 400
expect "publish" "$(req POST /api/sites/$SID/publish $ADMIN "{\"baseVersion\":$V,\"html\":\"$HTML\",\"note\":\"first\"}")" 200
[ -n "$PUB" ] && { [ -f "$PUB/demo-site/index.html" ] && ok "file written" || bad "file written"; }
req GET /api/sites/$SID $ADMIN >/dev/null; expect "published flag" "$(body | jq -r .published)" true
expect "no unpublished changes" "$(body | jq -r .unpublishedChanges)" false
V=$(body | jq -r .version)
req PUT /api/sites/$SID/draft $ADMIN "{\"baseVersion\":$V,\"document\":$DOC}" >/dev/null
req GET /api/sites/$SID $ADMIN >/dev/null; expect "edit after publish flags changes" "$(body | jq -r .unpublishedChanges)" true
req GET /api/sites/$SID/versions $ADMIN >/dev/null; expect "version recorded" "$(body | jq 'length')" 1
expect "restore version" "$(req POST /api/sites/$SID/versions/1/restore $ADMIN)" 200
req GET /api/sites/$SID $ADMIN >/dev/null; expect "draft restored" "$(body | jq -r .document.name)" "Demo v2"
expect "address locked while published" "$(req PATCH /api/sites/$SID $ADMIN '{"slug":"other"}')" 409
expect "unpublish" "$(req POST /api/sites/$SID/unpublish $ADMIN)" 204
[ -n "$PUB" ] && { [ ! -e "$PUB/demo-site" ] && ok "file removed" || bad "file removed"; }

echo "assets"
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR' > /tmp/smoke.png; echo '<svg onload=alert(1)>' > /tmp/smoke.svg
code=$(curl -s -o /tmp/smoke.out -w '%{http_code}' -X POST $BASE/api/sites/$SID/assets -H "Authorization: Bearer $EVE" -F "file=@/tmp/smoke.png;type=image/png")
expect "png upload" "$code" 200; URL=$(body | jq -r .url); AID=$(body | jq -r .id)
case "$URL" in */_assets/$SID/*.png) ok "url shape";; *) bad "url shape" "$URL";; esac
code=$(curl -s -o /tmp/smoke.out -w '%{http_code}' -X POST $BASE/api/sites/$SID/assets -H "Authorization: Bearer $EVE" -F "file=@/tmp/smoke.svg;type=image/png")
expect "svg refused even with a png content-type" "$code" 400
expect "delete asset" "$(req DELETE /api/sites/$SID/assets/$AID $EVE)" 204

echo "cleanup rules"
ME=$(curl -s $BASE/api/auth/me -H "Authorization: Bearer $ADMIN" | jq -r .id)
expect "cannot delete your own account" "$(req DELETE /api/users/$ME $ADMIN)" 400
expect "owner deletes site" "$(req DELETE /api/sites/$SID $ADMIN)" 204
expect "editor creates a site of their own" "$(req POST /api/sites $EVE '{"name":"Eve Site"}')" 200
ESID=$(body | jq -r .id)
expect "cannot delete a user who is the only owner of a site" "$(req DELETE /api/users/$EVE_ID $ADMIN)" 409
expect "admin can still open any site" "$(req GET /api/sites/$ESID $ADMIN)" 200
expect "admin deletes that site" "$(req DELETE /api/sites/$ESID $ADMIN)" 204
expect "now the user can be deleted" "$(req DELETE /api/users/$EVE_ID $ADMIN)" 204
expect "deleted user's token stops working" "$(req GET /api/sites $EVE)" 401

echo; echo "passed $pass, failed $fail"; [ $fail -eq 0 ]
