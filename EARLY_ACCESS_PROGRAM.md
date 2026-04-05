# Zayvora Early Access Program v1.0

**Program Status:** ACTIVE  
**Application Deadline:** 2026-06-30  
**Membership Duration:** 2026-04-05 → 2026-09-30 (6 months)  
**Global Launch:** 2026 Q4 (October 2026)

---

## Program Overview

Zayvora Early Access is an exclusive program for **500 professional engineering teams and enterprises** to test, validate, and shape the platform before its global commercial launch.

### Who Can Apply?

✅ **Professional Software Engineering Teams**
- At startups, scale-ups, and enterprises
- Shipping production code regularly
- Ready to provide structured feedback

❌ **NOT For**
- Students or educational institutions
- Learning/hobby projects
- Non-technical teams
- Solo freelancers (exception: agency owners with team)

---

## What's Included in Early Access

### Features
- Autonomous codebase analysis and architecture detection
- GitHub repository orchestration (branch creation, PR management, merge automation)
- Infrastructure monitoring and decision automation
- Local-first execution (data stays on your infrastructure)
- Command-line interface and web dashboard
- Ollama model (self-hosted deployment)

### Support
- Email support channel (response time: 24-48 hours)
- Private Slack community with core team
- Weekly office hours (community Q&A)
- Direct feature request process
- Roadmap transparency and voting

### Pricing
- **Free during early access period** (through 2026-09-30)
- **Lifetime discounted rate** locked in upon approval
- **Up to 3 team members** can use your access token
- Transfer membership to a different team member anytime

---

## What's NOT Included

### Production SLAs
- ❌ 99.9% uptime guarantee
- ❌ Production support contracts
- ❌ Dedicated support engineer
- ❌ Custom feature development
- ❌ Priority incident response

### Advanced Features
- ❌ GitLab integration (launching Q3 2026)
- ❌ Multi-repo transaction guarantees (Q3 2026)
- ❌ Advanced analytics dashboard (Q3 2026)
- ❌ Team-based audit trails (Q4 2026)
- ❌ SAML/SSO integration (Q4 2026)

### Limitations
- **Rate Limit:** 500 requests/month
- **Repository Limit:** Up to 10 private repos per team
- **Team Members:** 3 simultaneous users per token
- **Data Retention:** 30 days of logs and decision history
- **Export:** Limited to JSON format (advanced formats in paid tier)

---

## Program Terms

### 1. Data & Privacy
- Your code and infrastructure data **never leaves your hardware** by default
- Local-first execution means Zayvora runs on your infrastructure
- Zayvora sends only **non-code metadata** to our service:
  - Repo names (not code)
  - Decision outcomes (not source)
  - Error types (not error context)
- GDPR compliant. Full privacy policy: https://daxini.xyz/privacy

### 2. Feedback & Iteration
- Your team commits to **monthly feedback sessions** (30 min)
- Share feature requests via voting system
- Expected: 2-3 breaking changes during early access
- You'll receive migration guides for updates

### 3. Termination Policy
You can cancel anytime. We may terminate your access if:
- You violate terms of service (automated attacks, data exfiltration, etc.)
- You exceed usage limits for 2 consecutive months
- Your company is directly competing with Zayvora

### 4. Confidentiality
- Zayvora roadmap is confidential
- You can discuss your use of Zayvora publicly
- You cannot disclose benchmark results without approval
- Core team members are happy to do case studies (optional)

### 5. Transition to Paid
- On 2026-10-01, Zayvora transitions to paid plans
- Your early access team gets **locked-in lifetime discount** (typically 50% off standard pricing)
- No obligation to convert to paid (you can discontinue)
- Conversion is one-click: approve billing and continue

---

## Program Timeline

```
2026-04-05  Early Access launches
2026-06-30  Application deadline (500 slots)
2026-09-30  Early Access period ends
2026-10-01  Commercial launch (paid plans begin)
            Early access members keep lifetime discounts
```

---

## Access Token Management

### Getting Your Token

1. **Apply** via https://daxini.xyz/early-access
2. **Wait** for approval email (24-48 hours)
3. **Receive** your unique access token
4. **Activate** in your environment

### Token Format
```
zayvora_ea_[64-character-hex-string]
```

### Token Sharing
- Share token with **up to 3 team members**
- Each team member can use independently
- Token is tied to email domain, not individual user
- Revoke a token anytime from dashboard

### Token Expiration
- Tokens expire after **1 year** (2027-04-05)
- Renewal: one-click renewal for active members
- Early access → paid conversion extends expiration automatically

### Token Security
- Treat tokens like passwords (never commit to repos)
- Store in `.env` files, not source code
- Tokens do not contain secrets (stateless JWT validation)
- Report compromised tokens immediately to security@daxini.xyz

---

## Technical Integration

### Environment Setup
```bash
# .env file
ZAYVORA_EARLY_ACCESS_TOKEN=zayvora_ea_xxxxx
ZAYVORA_API_ENDPOINT=https://zayvora-runtime.daxini.xyz
ZAYVORA_ENVIRONMENT=early-access
```

### Activation
```bash
ollama run daxini2404/zayvora --token $ZAYVORA_EARLY_ACCESS_TOKEN
```

### Verification
```bash
curl -H "Authorization: Bearer $ZAYVORA_EARLY_ACCESS_TOKEN" \
  https://zayvora-runtime.daxini.xyz/api/auth/verify
# Returns: { valid: true, tier: "early-access", ... }
```

---

## Feedback Process

### Monthly Feedback Session
- 30-minute structured conversation with product team
- Share successes, blockers, feature requests
- First session scheduled immediately upon activation

### Feature Voting
- Access to backlog and quarterly roadmap
- Vote on features you want prioritized
- Top 10 community votes influence next sprint

### Issue Reporting
- Critical bugs: Slack urgent channel (30-min response)
- Feature requests: Feature request system (public voting)
- General feedback: Monthly meeting + email

---

## Frequently Asked Questions

### Q: Can I run this in production?
**A:** Early access is not production-ready. No SLA guarantees. Recommended for development/staging environments until commercial launch.

### Q: What happens if I exceed rate limits?
**A:** First 2 months: we'll notify you. After: requests get throttled. Upgrade to paid plan for higher limits.

### Q: Can I commercialize my usage of Zayvora?
**A:** No. Early access terms prohibit selling services built on top of Zayvora. You can use it internally. Contact sales@daxini.xyz for commercial licensing.

### Q: What if I find a security vulnerability?
**A:** Report to security@daxini.xyz immediately. Early access members get recognition + permanent discount upgrade.

### Q: Do you offer educational licenses?
**A:** Not at this time. Zayvora is built for professional teams. For student projects, see open-source alternatives.

### Q: Can I transfer my access token to another person?
**A:** Yes, share it with up to 3 team members. For company changes: contact support@daxini.xyz to transfer ownership.

---

## Support Channels

| Channel | Response Time | Use For |
|---------|---------------|---------|
| 📧 Email | 24-48 hours | General questions, feedback |
| 💬 Slack | 24 hours | Non-urgent discussion, community |
| 🔴 Urgent | 30 min | Critical bugs, security issues |
| 🎥 Office Hours | Weekly | Live Q&A, walkthroughs |
| 📋 Backlog | N/A | Feature requests, voting |

**Email:** early-access@daxini.xyz  
**Slack:** Join via your approval email  
**Urgent:** critical@daxini.xyz (include token ID)

---

## Admin Dashboard Access

**For Approval Team Only:**

```bash
# Check pending applications
curl "https://daxini.xyz/api/early-access/admin/pending?admin_key=$ADMIN_KEY"

# Approve an application
curl -X POST https://daxini.xyz/api/early-access/admin/approve \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@company.com",
    "admin_key": "'$ADMIN_KEY'"
  }'

# Reject an application
curl -X POST https://daxini.xyz/api/early-access/admin/reject \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@company.com",
    "admin_key": "'$ADMIN_KEY'",
    "reason": "Company does not match early access criteria"
  }'
```

---

## Graduation to Paid Plans

### Early Access → Commercial Pricing (Standard Tier)
| Feature | Early Access | Standard | Enterprise |
|---------|-------------|----------|-----------|
| Monthly Cost | Free | $499 | Custom |
| Rate Limit | 500 reqs/mo | 10k reqs/mo | Unlimited |
| Repos | 10 private | 50 private | Unlimited |
| Team Members | 3 | 10 | 100+ |
| Support | Email | Priority email | Dedicated |
| SLA | None | 99.5% | 99.9% |

### Early Access Lifetime Discount
- **50% off Standard Tier** ($249/month instead of $499)
- **40% off Enterprise pricing**
- Locked in **forever** (never expires, even if you pause)

### How to Upgrade
1. Log in to dashboard
2. Click "Upgrade to Paid"
3. Choose tier
4. Add billing info
5. Continue using same token (auto-activated)

---

## Contact & Support

**Application Questions:** early-access@daxini.xyz  
**Technical Support:** support@daxini.xyz  
**Security Issues:** security@daxini.xyz  
**Billing:** billing@daxini.xyz  

**Community Slack:** Invite sent with approval email  
**X (Twitter):** @DaxiniLabs  
**Website:** https://daxini.xyz

---

**Last Updated:** 2026-04-05  
**Version:** 1.0  
**Author:** Daxini Labs (Zayvora Core Team)
