# Zayvora Early Access Workspace

This directory contains all workspace files for managing the Zayvora Early Access program.

## Directory Structure

```
workspace/
├── tokens.json              # Approved member tokens and metadata
├── ADMIN_INTERFACE.md       # Admin operations and workflow
├── README.md               # This file
└── ARCHIVED/               # Old/revoked tokens (for audit trail)
```

## Files

### `tokens.json`
**Purpose:** Track all approved early access members and their tokens  
**Format:** JSON with member metadata  
**Updated By:** Admin, after approval via `/api/early-access/admin/approve`  
**Sensitive:** ⚠️ Contains active tokens, store securely

**Sample Entry:**
```json
{
  "token": "zayvora_ea_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
  "email": "engineering@company.com",
  "company": "TechCorp Inc",
  "team_size": "6-15",
  "status": "active",
  "created_at": "2026-04-05T12:00:00Z",
  "expires_at": "2027-04-05T12:00:00Z",
  "last_used": "2026-04-05T13:45:00Z"
}
```

### `ADMIN_INTERFACE.md`
**Purpose:** Complete admin guide for approvals, rejections, monitoring  
**Audience:** Approval team only  
**Contains:**
- API endpoints for admin operations
- Approval workflow
- Rate limiting policy
- Email templates
- Security best practices

---

## Quick Reference

### View Pending Applications
```bash
# Set your admin key first
export ZAYVORA_ADMIN_KEY="your-secure-admin-key"

curl "https://daxini.xyz/api/early-access/admin/pending?admin_key=$ZAYVORA_ADMIN_KEY"
```

### Approve a Member
```bash
curl -X POST https://daxini.xyz/api/early-access/admin/approve \
  -H "Content-Type: application/json" \
  -d '{
    "email": "engineering@company.com",
    "admin_key": "'$ZAYVORA_ADMIN_KEY'"
  }'
```

### Check Application Status
```bash
curl "https://daxini.xyz/api/early-access/status/engineering@company.com"
```

---

## Token Lifecycle

1. **Creation:** Admin approves application → token generated
2. **Activation:** Member uses token in their environment
3. **Usage:** Token accumulates requests (max 500/month)
4. **Monitoring:** Track in `tokens.json` with usage metrics
5. **Expiration:** After 1 year (can be renewed)
6. **Revocation:** If abuse detected or member cancels
7. **Archive:** Move to `ARCHIVED/` for historical reference

---

## Security Checklist

- [ ] `$ZAYVORA_ADMIN_KEY` is NOT committed to git (add to `.env.local`)
- [ ] `tokens.json` is NOT publicly accessible
- [ ] Admin access logs are enabled
- [ ] Tokens are masked in logs (not logged in plain text)
- [ ] Admin key rotated every 90 days
- [ ] `tokens.json` backed up weekly

---

## Environment Variables

```bash
# Required
ZAYVORA_ADMIN_KEY=your-super-secret-admin-key

# Optional
ZAYVORA_EARLY_ACCESS_RATE_LIMIT=500  # requests per month
ZAYVORA_EARLY_ACCESS_SLOT_CAP=500    # max approved members
ZAYVORA_EARLY_ACCESS_PROGRAM_END=2026-09-30
```

---

## Monitoring & Reporting

### Monthly Report Template
```markdown
# Zayvora Early Access Monthly Report - April 2026

## Approvals
- Total applications received: 342
- Approved: 150
- Rejected: 45
- Pending: 147
- Approval rate: 77%

## Active Members
- Total: 150
- Average usage: 245 requests/month
- Highest usage: 495 requests/month
- Zero usage: 3 members (candidates for follow-up)

## Feedback Summary
- Top feature request: GitLab integration
- Top pain point: Rate limiting on large repos
- Satisfaction score: 4.2/5.0

## Issues & Resolutions
- 2 token revocations (unauthorized use)
- 1 rate limit exception granted (research team)
- 0 data incidents

## Next Month Focus
- Ship GitLab support (voted #1)
- Increase rate limit pilot (5 teams)
- Schedule follow-up with inactive members
```

---

## FAQ

**Q: Where are tokens stored?**  
A: In `tokens.json` (this workspace) and in the SQLite database (`database/users.db`). Tokens are also distributed to approved members via secure email.

**Q: What if someone loses their token?**  
A: They can request a new one. Check `workspace/tokens.json`, generate a new token with the same email, and send via secure email.

**Q: How do I revoke a token?**  
A: Update `tokens.json` and set `"status": "revoked"`. They'll be blocked from API access within 5 minutes.

**Q: Can I backup tokens.json?**  
A: Yes, backup weekly. Store encrypted backups. Never commit to git.

**Q: What happens to tokens after the early access ends?**  
A: On 2026-10-01, they convert to paid plan tokens (if they choose to continue). Otherwise, tokens expire automatically.

---

## Support

**For Admins:** Review `ADMIN_INTERFACE.md`  
**For Members:** Point to https://daxini.xyz/early-access  
**For Urgent Issues:** critical@daxini.xyz

---

**Last Updated:** 2026-04-05  
**Maintained By:** Zayvora Core Team
