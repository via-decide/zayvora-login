# Zayvora Early Access Admin Interface

**Admin Key Location:** `$ZAYVORA_ADMIN_KEY` environment variable  
**Default (Dev Only):** `dev-admin-key-change-in-production`

---

## Admin Operations

### 1. View Pending Applications

```bash
ADMIN_KEY="your-secure-admin-key"

curl "https://daxini.xyz/api/early-access/admin/pending?admin_key=$ADMIN_KEY" \
  | jq '.'
```

**Response:**
```json
{
  "applications": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "engineering@company.com",
      "company": "TechCorp Inc",
      "team_size": "6-15",
      "use_case": "CI/CD automation for microservices deployment",
      "created_at": "2026-04-05T10:30:00Z"
    }
  ],
  "count": 42
}
```

---

### 2. Approve an Application

```bash
curl -X POST https://daxini.xyz/api/early-access/admin/approve \
  -H "Content-Type: application/json" \
  -d '{
    "email": "engineering@company.com",
    "admin_key": "'$ADMIN_KEY'"
  }' | jq '.'
```

**Response:**
```json
{
  "message": "Application approved successfully.",
  "access_token": "zayvora_ea_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
  "expires_at": "2027-04-05T10:30:00Z"
}
```

**Next Step:** Send approval email to applicant with the `access_token`.

---

### 3. Reject an Application

```bash
curl -X POST https://daxini.xyz/api/early-access/admin/reject \
  -H "Content-Type: application/json" \
  -d '{
    "email": "engineering@company.com",
    "admin_key": "'$ADMIN_KEY'",
    "reason": "Duplicate application"
  }' | jq '.'
```

**Response:**
```json
{
  "message": "Application rejected."
}
```

**Next Step:** Optionally send rejection email with constructive feedback.

---

## Approval Workflow

### Intake
1. Applicant submits via https://daxini.xyz/early-access
2. Application stored in SQLite database
3. Notification sent to approval team

### Review (24-48 hours)
- Read: Company legitimacy, team size, use case alignment
- Check: No duplicate emails (UNIQUE constraint blocks)
- Decision: Approve or Reject (no partial/pending states)

### Approval
- Generate token
- Update status to "approved"
- Email applicant with token and quick-start guide

### Rejection (Optional)
- Update status to "rejected"
- Email applicant with reason (constructive, invite reapplication)

---

## Tracking Approved Members

All approved tokens are stored in `workspace/tokens.json` with metadata:

```json
{
  "approved_members": [
    {
      "token": "zayvora_ea_a1b2c3d4...",
      "email": "engineering@company.com",
      "company": "TechCorp Inc",
      "team_size": "6-15",
      "status": "active",
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

### Format for Saving
After approving an application, save it locally:

```bash
# Save approval record
cat >> workspace/tokens.json << EOF
{
  "token": "zayvora_ea_...",
  "email": "engineering@company.com",
  "company": "TechCorp Inc",
  "team_size": "6-15",
  "status": "active",
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "expires_at": "$(date -u -d '+1 year' +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
```

---

## Rate Limiting & Monitoring

### Usage Tracking
Each token can make **500 API requests per month**.

Monitor via:
```bash
# Check token usage (dashboard or logs)
grep "early-access" /var/log/zayvora/api.log | tail -100
```

### Throttling Policy
- **0-400 requests:** Normal operation
- **400-490 requests:** Warning email sent ("You're using 98% of quota")
- **490+ requests:** Requests rejected with 429 (Too Many Requests)
- Quota resets on the 1st of each month

---

## Security & Admin Best Practices

### 1. Admin Key Rotation
- Change `$ZAYVORA_ADMIN_KEY` every 90 days
- Update in production deployment configs
- Old tokens remain valid (backwards compatible)

### 2. Sensitive Data Handling
- Never log full tokens
- Never email full tokens in plain text (only to secure recipient)
- Mask tokens in logs: `zayvora_ea_[REDACTED]`

### 3. Audit Trail
All approvals logged:
```
[Zayvora-EarlyAccess-Admin] Application approved: engineering@company.com
[Zayvora-EarlyAccess-Admin] Application rejected: education-team@school.edu
```

### 4. Access Control
Only approved admins should have:
- `$ZAYVORA_ADMIN_KEY` (never commit to repos)
- Access to `workspace/tokens.json`
- Access to SQLite database (`database/users.db`)

---

## Quota Management

### Application Slots
- **Total Slots:** 500 teams
- **Deadline:** 2026-06-30
- **Status Tracking:** Dashboard shows "187 / 500 approved"

### Adjust Quota
If quota limit reached early:
1. Discuss with product team
2. Consider extending deadline to 2026-07-15
3. Or increase slot cap to 750 (requires infrastructure review)

---

## Email Templates

### Approval Email
```
Subject: Zayvora Early Access Approved - Your Access Token

Hi [Company Name] team,

Your application to Zayvora Early Access has been approved!

You're now one of 500 elite engineering teams shaping the future of 
autonomous software development.

Your Access Token:
zayvora_ea_[TOKEN]

This token is valid until: [EXPIRY_DATE]

Quick Start:
1. Set environment variable: export ZAYVORA_TOKEN=[TOKEN]
2. Pull the model: ollama run daxini2404/zayvora
3. Activate: zayvora --token $ZAYVORA_TOKEN

Documentation: https://daxini.xyz/docs/early-access

Join our Slack community: [SLACK_LINK]

Monthly feedback sessions start [DATE]. Calendar invite sent separately.

Questions? Reply to this email or contact early-access@daxini.xyz

Welcome to the Zayvora community!
–– The Zayvora Core Team
```

### Rejection Email (Optional)
```
Subject: Zayvora Early Access Application Update

Hi [Name],

Thank you for applying to the Zayvora Early Access program.

After review, we've decided not to move forward at this time. 
Reason: [SPECIFIC REASON]

This is not permanent. We encourage reapplication when:
- [CONDITION 1]
- [CONDITION 2]

We're committed to responsible AI in engineering, so we're selective 
about early access participants.

If you have questions, feel free to reach out.

Best,
–– The Zayvora Team
```

---

## Monthly Admin Checklist

- [ ] Review pending applications (check for 24-48h SLA)
- [ ] Approve qualified applications
- [ ] Monitor usage: any tokens approaching quota?
- [ ] Check for issues: errors, complaints, refunds
- [ ] Update `tokens.json` with new approvals
- [ ] Rotate admin key (if 90 days passed)
- [ ] Generate monthly report: approvals, active users, feedback

---

## Dashboard Links

- **Approvals Pending:** https://daxini.xyz/admin/dashboard
- **Token Usage:** https://daxini.xyz/admin/tokens
- **Feedback Votes:** https://daxini.xyz/admin/feedback
- **API Logs:** https://daxini.xyz/admin/logs

---

**Last Updated:** 2026-04-05  
**Version:** 1.0
