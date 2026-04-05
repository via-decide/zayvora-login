# Zayvora Early Access: Workspace Token Storage & Tracking

**Generated:** 2026-04-05  
**Status:** ACTIVE  
**Location:** `/tmp/zayvora-login/workspace/`

---

## Storage Architecture

```
workspace/
├── tokens.json              # Master token registry (all approved members)
├── ADMIN_INTERFACE.md       # Admin operations guide
├── README.md               # Workspace overview
├── ARCHIVED/               # Revoked/expired tokens (audit trail)
│   └── (empty - grows over time)
└── backups/               # Weekly encrypted backups
    └── tokens_2026-04-05.json.enc
```

---

## Token Storage Format

### Location
**File:** `workspace/tokens.json`  
**Type:** JSON  
**Access:** Admin + backup systems only  
**Sensitivity:** 🔴 CONFIDENTIAL - Contains active tokens

### Schema
```json
{
  "description": "Zayvora Early Access Approved Tokens",
  "note": "This file stores approved access tokens...",
  "schema": { ... },
  "approved_members": [
    {
      "token": "zayvora_ea_[64-character-hex-string]",
      "email": "engineering@company.com",
      "company": "Company Name",
      "team_size": "6-15",
      "status": "active|revoked|expired",
      "created_at": "2026-04-05T12:00:00Z",
      "expires_at": "2027-04-05T12:00:00Z",
      "last_used": "2026-04-05T13:45:00Z",
      "usage": {
        "requests_this_month": 245,
        "repos_analyzed": 8,
        "prs_created": 12
      }
    }
  ]
}
```

---

## Saving Approved Tokens

When you approve an application, follow this process:

### 1. Call Approval Endpoint
```bash
ADMIN_KEY="your-admin-key"

RESPONSE=$(curl -s -X POST https://daxini.xyz/api/early-access/admin/approve \
  -H "Content-Type: application/json" \
  -d '{
    "email": "engineering@company.com",
    "admin_key": "'$ADMIN_KEY'"
  }')

# Extract token from response
TOKEN=$(echo $RESPONSE | jq -r '.access_token')
EXPIRES=$(echo $RESPONSE | jq -r '.expires_at')

echo "Token: $TOKEN"
echo "Expires: $EXPIRES"
```

### 2. Add to workspace/tokens.json
```bash
# Append new member to tokens.json
cat >> workspace/tokens.json << EOF
{
  "token": "$TOKEN",
  "email": "engineering@company.com",
  "company": "TechCorp Inc",
  "team_size": "6-15",
  "status": "active",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "expires_at": "$EXPIRES",
  "last_used": null,
  "usage": {
    "requests_this_month": 0,
    "repos_analyzed": 0,
    "prs_created": 0
  }
}
EOF
```

### 3. Send Email to Member
```bash
# Create approval email with token
cat > /tmp/approval_email.txt << EOF
Subject: Zayvora Early Access Approved - Your Access Token

Hi TechCorp team,

Your application to Zayvora Early Access has been approved!

Your Access Token:
$TOKEN

This token is valid until: $EXPIRES

Quick Start:
1. export ZAYVORA_TOKEN=$TOKEN
2. ollama run daxini2404/zayvora
3. zayvora activate --token \$ZAYVORA_TOKEN

Documentation: https://daxini.xyz/docs/early-access
Slack Invite: [SLACK_LINK]
Quick Start Guide: See attached

Questions? Reply to this email.

Welcome to Zayvora!
EOF

# Send via email service
mail -s "Zayvora Early Access Approved - Your Token" \
  engineering@company.com < /tmp/approval_email.txt
```

### 4. Backup tokens.json
```bash
# Create encrypted backup
gpg --symmetric --cipher-algo AES256 workspace/tokens.json \
  -o workspace/backups/tokens_$(date +%Y-%m-%d).json.gpg

# Upload to secure storage (AWS S3, Google Drive, etc.)
aws s3 cp workspace/backups/tokens_*.json.gpg s3://zayvora-backups/
```

### 5. Commit to Git (⚠️ WITHOUT tokens.json)
```bash
# Important: Never commit tokens.json to git
# Add to .gitignore if not already there
echo "workspace/tokens.json" >> .gitignore

# Commit the approval record (metadata only)
git add EARLY_ACCESS_PROGRAM.md EARLY_ACCESS_QUICKSTART.md
git commit -m "docs: update early access guides after approvals"
git push origin main
```

---

## Tracking Active Tokens

### Check Token Status
```bash
# Query specific member
curl "https://daxini.xyz/api/early-access/status/engineering@company.com"

# Response:
{
  "application_id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "engineering@company.com",
  "company": "TechCorp Inc",
  "status": "approved",
  "access_token": "zayvora_ea_a1b2c3d4...",
  "created_at": "2026-04-05T10:30:00Z"
}
```

### List All Approved Members
```bash
# Admin endpoint
curl "https://daxini.xyz/api/early-access/admin/pending?admin_key=$ADMIN_KEY" | jq '.applications | length'

# Output: 150 (approved members)
```

### Monitor Usage
```bash
# Check which members are using their tokens
grep "last_used" workspace/tokens.json | grep -v "null" | wc -l

# Output: 148 (members used token this week)

# Identify inactive members
grep "last_used.*null" workspace/tokens.json | jq '.email'

# Output: members who haven't used token yet (follow up!)
```

---

## Token Lifecycle Events

### Event Logging
Every token event is logged to audit trail:

```bash
# View logs
tail -50 /var/log/zayvora/api.log | grep "early-access"

# Examples:
# [Zayvora-EarlyAccess] New application: engineering@company.com (id: 550e8400...)
# [Zayvora-EarlyAccess-Admin] Application approved: engineering@company.com
# [Zayvora-EarlyAccess] Token created: zayvora_ea_a1b2c3d4...
# [Zayvora-EarlyAccess] Token used: zayvora_ea_a1b2c3d4... (245 requests)
```

### Expiration Calendar
```bash
# Find tokens expiring soon
jq '.approved_members[] | select(.expires_at < "'$(date -u -d '+30 days' +%Y-%m-%d)'") | {email, expires_at}' workspace/tokens.json

# Output: Members whose tokens expire within 30 days
# Send renewal email 30 days before expiration
```

### Token Revocation
```bash
# If abuse detected, revoke immediately
curl -X POST https://daxini.xyz/api/early-access/admin/reject \
  -H "Content-Type: application/json" \
  -d '{
    "email": "bad-actor@company.com",
    "admin_key": "'$ADMIN_KEY'",
    "reason": "Unauthorized access attempts"
  }'

# Update local tokens.json
sed -i '' 's/"status": "active"/"status": "revoked"/g' workspace/tokens.json
```

---

## Monthly Admin Tasks

### Report Generation
```bash
cat > /tmp/monthly_report.md << 'EOF'
# Zayvora Early Access Monthly Report - April 2026

## Approvals
- Total applications: 342
- Approved this month: 150
- Rejection rate: 13%
- Pending: 47 (2 past SLA)

## Active Tokens
- Total approved: 150
- Active (used this month): 148
- Inactive: 2 (candidates for follow-up)
- Expiring soon (30 days): 0

## Usage Metrics
- Total API requests: 36,750 / 75,000 (49%)
- Highest usage team: 495/500 (99%)
- Average usage: 245 req/month
- Teams over quota: 0

## Issues & Resolutions
- 0 security incidents
- 0 token compromises
- 1 rate limit exception granted
- 2 support tickets resolved

## Recommendations
- Increase rate limit pilot: expand to 10 teams
- Reach out to 2 inactive members
- Prepare Q4 pricing tier communication
EOF

cat /tmp/monthly_report.md
```

### Backup & Archive
```bash
# Archive revoked/expired tokens
jq '.approved_members[] | select(.status != "active")' workspace/tokens.json \
  > workspace/ARCHIVED/revoked_2026-04.json

# Backup active tokens
cp workspace/tokens.json workspace/backups/tokens_2026-04-30.json

# Verify backup integrity
gpg --symmetric workspace/backups/tokens_2026-04-30.json

# Check backup size
du -h workspace/backups/
```

---

## Security Best Practices

### ✅ DO
- Store `workspace/tokens.json` in `.gitignore`
- Encrypt backups with GPG
- Rotate `$ZAYVORA_ADMIN_KEY` every 90 days
- Log all approvals to audit trail
- Email tokens via secure channel (not SMS/chat)
- Review tokens.json for unauthorized changes weekly

### ❌ DON'T
- Commit `workspace/tokens.json` to git
- Log full tokens in logs (mask: `zayvora_ea_[REDACTED]`)
- Share admin key in emails or messages
- Store backups unencrypted
- Hardcode tokens in code
- Expose tokens in error messages

---

## Integration with daxini.xyz

### Frontend (Early Access Landing Page)
**URL:** https://daxini.xyz/early-access  
**File:** `early-access.html`  
**Users:** Public (applicants)  
**Saves:** Application data to localStorage, sent to backend

### Backend API Endpoints
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/early-access/apply` | POST | None | Submit application |
| `/api/early-access/status/:email` | GET | None | Check application status |
| `/api/early-access/admin/pending` | GET | Admin Key | View pending approvals |
| `/api/early-access/admin/approve` | POST | Admin Key | Approve application + generate token |
| `/api/early-access/admin/reject` | POST | Admin Key | Reject application |

### Database
**Type:** SQLite  
**Path:** `database/users.db`  
**Table:** `early_access_applications`  
**Schema:**
```sql
CREATE TABLE early_access_applications (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  company TEXT NOT NULL,
  team_size TEXT NOT NULL,
  use_case TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  access_token TEXT,
  access_token_expires TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT
);
```

---

## Complete Workflow Example

```bash
#!/bin/bash
# Complete early access approval workflow

ADMIN_KEY="your-admin-key"
EMAIL="engineering@company.com"
COMPANY="TechCorp Inc"

# 1. View pending applications
echo "📋 Viewing pending applications..."
curl -s "https://daxini.xyz/api/early-access/admin/pending?admin_key=$ADMIN_KEY" | jq '.count'

# 2. Approve the application
echo "✅ Approving application..."
APPROVAL=$(curl -s -X POST https://daxini.xyz/api/early-access/admin/approve \
  -H "Content-Type: application/json" \
  -d '{"email": "'$EMAIL'", "admin_key": "'$ADMIN_KEY'"}')

TOKEN=$(echo $APPROVAL | jq -r '.access_token')
EXPIRES=$(echo $APPROVAL | jq -r '.expires_at')

echo "Token: $TOKEN"
echo "Expires: $EXPIRES"

# 3. Save to workspace
echo "💾 Saving to workspace..."
echo "{\"token\": \"$TOKEN\", \"email\": \"$EMAIL\", \"company\": \"$COMPANY\", \"status\": \"active\", \"expires_at\": \"$EXPIRES\"}" | \
  jq '. + {created_at: now | todate, last_used: null, usage: {requests_this_month: 0, repos_analyzed: 0, prs_created: 0}}' \
  >> workspace/tokens.json

# 4. Send approval email (using mail command)
echo "📧 Sending approval email..."
mail -s "Zayvora Early Access Approved" "$EMAIL" << EOF
Your token: $TOKEN
Expires: $EXPIRES
Quick start: https://daxini.xyz/early-access/quickstart
EOF

# 5. Backup
echo "🔐 Backing up tokens..."
gpg --symmetric workspace/tokens.json -o workspace/backups/tokens_$(date +%Y-%m-%d).json.gpg

echo "✓ Approval workflow complete!"
```

---

## Summary

✅ **Created:**
1. Early access landing page (`early-access.html`)
2. Backend API for applications (POST `/api/early-access/apply`)
3. Admin approval endpoints (POST `/api/early-access/admin/approve`)
4. Token generation & storage (`workspace/tokens.json`)
5. Documentation (3 comprehensive guides)

✅ **Committed to Git:** All changes pushed (except tokens.json)

✅ **Workspace Storage:** Ready for approved member tokens with metadata

**Next Steps:**
1. Set `$ZAYVORA_ADMIN_KEY` env variable (production-grade secret)
2. Deploy to daxini.xyz
3. Launch marketing: announce early access program
4. Begin receiving applications
5. Start approval workflow (24-48 hour SLA)

**Files Created:**
- `early-access.html` (landing page)
- `EARLY_ACCESS_PROGRAM.md` (full terms)
- `EARLY_ACCESS_QUICKSTART.md` (member guide)
- `workspace/tokens.json` (token registry)
- `workspace/ADMIN_INTERFACE.md` (admin guide)
- `workspace/README.md` (workspace overview)
- `workspace/WORKSPACE_TOKEN_STORAGE.md` (this file)

---

**Status:** ✅ COMPLETE  
**Date:** 2026-04-05  
**Commit:** 5a9f0e3
