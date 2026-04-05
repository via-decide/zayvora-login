# Zayvora Early Access Quick Start

**Welcome!** You're now part of 500 elite engineering teams reshaping autonomous software development.

---

## Your Access Token

```
zayvora_ea_[YOUR_TOKEN_HERE]
```

**⚠️ Important:** Treat this token like a password
- Never commit to git
- Never share publicly
- Store in `.env` files only
- Report compromise immediately to security@daxini.xyz

---

## Step 1: Set Up Your Environment

### macOS / Linux
```bash
# Create .env file in your project
echo "ZAYVORA_EARLY_ACCESS_TOKEN=zayvora_ea_[YOUR_TOKEN]" > .env

# Load it into your shell
source .env

# Verify
echo $ZAYVORA_EARLY_ACCESS_TOKEN
```

### Windows (PowerShell)
```powershell
# Create .env file
$token = "zayvora_ea_[YOUR_TOKEN]"
Set-Content -Path ".env" -Value "ZAYVORA_EARLY_ACCESS_TOKEN=$token"

# Load it
Get-Content .env | foreach-object {
    $name, $value = $_.split('=')
    Set-Item -Path env:\$name -Value $value
}
```

---

## Step 2: Install Zayvora

### Using Ollama (Recommended - Local First)

```bash
# Install Ollama if you haven't
# macOS: brew install ollama
# Linux: https://ollama.ai/download
# Windows: https://ollama.ai/download

# Pull Zayvora model
ollama pull daxini2404/zayvora:latest

# Verify installation
ollama list | grep zayvora
# Expected output: daxini2404/zayvora  7.3GB
```

### Using Docker

```bash
docker run -it \
  -e ZAYVORA_TOKEN=$ZAYVORA_EARLY_ACCESS_TOKEN \
  daxini2404/zayvora:latest
```

### Using CLI

```bash
# Install Zayvora CLI
npm install -g zayvora-cli

# Verify
zayvora --version
# Output: Zayvora CLI v1.0.0
```

---

## Step 3: Activate Your Token

```bash
# Activate
zayvora activate --token $ZAYVORA_EARLY_ACCESS_TOKEN

# Verify activation
zayvora auth verify
# Expected response:
# ✓ Token valid
# ✓ Tier: early-access
# ✓ Expires: 2027-04-05
# ✓ Team members: 3/3 used (2 remaining)
```

---

## Step 4: Try It Out

### Analyze Your First Repository

```bash
# Navigate to any git repository
cd ~/my-awesome-project

# Run Zayvora analysis
zayvora analyze .

# Output:
# 🔍 Analyzing repository...
# ✓ Scanned 342 files
# ✓ Found architecture patterns
# ✓ Identified technical debt
# 
# Key Insights:
# - 15% of code is duplicated
# - Missing test coverage in auth module
# - Recommended refactor: UserService (complexity: 8.2)
```

### Create Your First Autonomous PR

```bash
# Set up GitHub token (if using GitHub automation)
export GITHUB_TOKEN=ghp_your_github_token

# Create an autonomous PR
zayvora task "fix broken tests in auth module"

# Output:
# 🚀 Creating task PR...
# ✓ Branch created: zayvora/fix-broken-tests-in-auth-module
# ✓ Code generated and tested
# ✓ PR created: https://github.com/your-org/your-repo/pull/42
# 
# Status: Ready for review
# Tests: 12/12 passing
# Coverage: +2.3%
```

---

## Step 5: Join the Community

### Slack Community
Link sent via your approval email. This is where you'll:
- Ask questions and get support
- Share wins and learnings
- Vote on features
- Connect with other early access members

### Monthly Feedback Session
- **When:** First Wednesday of each month, 2 PM UTC
- **Duration:** 30 minutes
- **Format:** Live discussion with product team
- **Calendar:** Sent in your approval email

### Feature Voting
- Go to https://feedback.daxini.xyz
- Vote on features for next quarter
- Top 10 community votes get prioritized

---

## Step 6: Set Up Integration (Optional)

### GitHub Integration

```bash
# Link your GitHub account (one-time setup)
zayvora github connect

# This enables:
# - Autonomous PR creation
# - CI/CD orchestration
# - Repository analysis
```

### GitLab Integration (Coming Q3 2026)

```bash
# Currently not available in early access
# Vote for priority: https://feedback.daxini.xyz
```

### Slack Integration (Coming Q3 2026)

```bash
# Currently not available in early access
# Planned: Receive Zayvora insights in Slack
```

---

## Usage Limits

Your early access tier includes:

| Resource | Limit | Resets |
|----------|-------|--------|
| API Requests | 500/month | 1st of month |
| Repositories | 10 private | One-time |
| Team Members | 3 users | N/A |
| Data Retention | 30 days | Rolling |
| Custom Features | Not available | N/A |

### Monitoring Your Usage

```bash
# Check current usage
zayvora quota

# Output:
# API Requests: 245 / 500 (49%)
# Repositories: 4 / 10 (40%)
# Team Members: 2 / 3 (67%)
# 
# Estimated reset: 2026-05-01
```

---

## Common Tasks

### Analyze Repository Architecture
```bash
zayvora analyze /path/to/repo --output json > architecture.json
```

### Get Code Quality Report
```bash
zayvora report quality --repo owner/repo --token $GITHUB_TOKEN
```

### Run Test Coverage Analysis
```bash
zayvora analyze tests/ --metrics coverage
```

### Generate README Documentation
```bash
zayvora generate docs --repo . --output README_AI.md
```

### Create Autonomous PR for Specific Task
```bash
zayvora task "add error handling to payment module" \
  --repo owner/repo \
  --branch main \
  --auto-merge false  # Requires manual review
```

---

## Troubleshooting

### Token Invalid

```bash
# Check if token is set
echo $ZAYVORA_EARLY_ACCESS_TOKEN

# Re-verify activation
zayvora auth verify

# If still failing:
# 1. Check token matches approval email exactly
# 2. Make sure no leading/trailing spaces
# 3. Re-authenticate: zayvora activate --token [TOKEN]
```

### Rate Limit Exceeded

```bash
# Check usage
zayvora quota

# If approaching limit, you have options:
# 1. Upgrade to paid plan (available Oct 2026)
# 2. Contact support: early-access@daxini.xyz
# 3. Consolidate API calls (batch operations)
```

### Installation Issues

```bash
# Verify Ollama is running
ollama serve

# Check model is loaded
ollama list

# Restart Ollama
pkill ollama
sleep 2
ollama serve

# Re-pull if needed
ollama pull daxini2404/zayvora:latest --force
```

---

## Getting Help

| Issue | Contact | Response Time |
|-------|---------|---------------|
| Token problems | early-access@daxini.xyz | 24-48 hours |
| Feature requests | Slack + https://feedback.daxini.xyz | Monthly vote |
| Bug reports | #support in Slack | 24 hours |
| Security issues | security@daxini.xyz | 4 hours |
| Billing/Admin | support@daxini.xyz | 24 hours |

---

## Next Steps

1. ✅ Set up environment (Step 1)
2. ✅ Install Zayvora (Step 2)
3. ✅ Activate token (Step 3)
4. ✅ Try first analysis (Step 4)
5. → Join Slack community (Step 5)
6. → Schedule your first feedback session
7. → Start using in your development workflow

---

## Program Terms Reminder

**Your early access includes:**
- Free usage through 2026-09-30
- Lifetime discounted pricing (50% off) after transition to paid
- Up to 3 team members on one token
- Direct feedback channel with core team

**Early access does NOT include:**
- Production SLA or uptime guarantees
- Priority support (24-48 hour response)
- Custom feature development
- Advanced integrations (launching Q3 2026)

Full terms: Read `EARLY_ACCESS_PROGRAM.md` or visit https://daxini.xyz/early-access

---

## Celebrate! 🎉

You're now using Zayvora, India's Sovereign AI Engineering Agent.

**Welcome to the future of autonomous software development.**

---

**Questions?** Reach out to early-access@daxini.xyz  
**Feedback?** Join #feedback in Slack  
**Found a bug?** Report to #support in Slack or security@daxini.xyz  

**Updated:** 2026-04-05  
**Version:** 1.0
