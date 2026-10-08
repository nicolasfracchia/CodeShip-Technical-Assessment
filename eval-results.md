# Eval results

Model: `groq-gpt-oss` · Base: http://localhost:3100 · 2026-10-08T05:03:52.696Z

## E10 blank message: PASS (HTTP 400)

## Q1: PASS (Pro vs Enterprise across products, incl. Relay $59 change (T2))

> What are the key differences between the Pro and Enterprise pricing tiers?

Answered by `groq-gpt-oss`

**Key differences between the Pro and Enterprise pricing tiers**

| Product | Pro tier (per source) | Enterprise tier (per source) | Main differences |
|---|---|---|---|
| **Nimbus Vault** | $35/seat · 10,000 secrets · SAML 2.0 · No HSM-backed keys · 180-day audit log · Standard support【S1】 | Custom price · Unlimited secrets · SAML 2.0 · Yes HSM-backed keys · 400-day audit log · Premium support【S1】 | • Unlimited secrets & HSM-backed keys only in Enterprise<br>• Longer audit-log retention (400 d vs 180 d)<br>• Higher-level support |
| **Nimbus Pulse** | $299/workspace · 50 M events · Session replay · Snowflake export · Standard support【S2】 | Custom price · Custom events · Session replay · Snowflake + BigQuery export · Premium support【S2】 | • Export to BigQuery only in Enterprise<br>• Event volume and price are custom in Enterprise |
| **Nimbus Ledger** | $199/month · $500 k invoiced volume included · SAML 2.0 login · Dunning · Standard support【S3】 | Custom price · Custom invoiced-volume limit · SAML 2.0 login · Dunning · Premium support【S3】 | • Invoiced-volume cap lifted (custom) and support upgraded in Enterprise |
| **Nimbus Relay** | $49/seat · 25 seats · 10 k req/min · No SSO · 90-day audit log · No request replay · US-only routing · Standard support【S4】<br>*(new contracts ≥ 1 Aug 2026: $59/seat)【S5】* | Custom price · Unlimited seats · 100 k req/min · SAML 2.0 · 400-day audit log · Request replay · US + EU routing · Premium support【S4】 | • Unlimited seats, higher rate limit, SAML 2.0, longer audit-log, request replay, EU routing, and Premium support are Enterprise-only |
| **All products** | Standard or Standard-level support | Premium or custom-level support | Support plan upgrades across the board |

**⚠️ Sources disagree:**  
- **Federated sign-in (SAML 2.0) for Nimbus Vault** - Company-wide overview lists SAML 2.0 **only on Enterprise**【S7】, while product documentation shows SAML 2.0 on **both Pro and Enterprise**【S1】 and release notes state it was extended to Pro in version 3.1【S6】 (2026-04-14). The newer product docs (2026-07-03) and release notes supersede the older company-wide summary.

## Q2-vault: PASS (Vault Salesforce version)

> Does Vault integrate with Salesforce? What version is required?

Answered by `groq-gpt-oss`

Yes - Nimbus Vault integrates with Salesforce.  

- Minimum Vault version: **3.1**【S1】  
- Partner requirement: **Salesforce API v58 or later** and a Connected App with the `api` scope【S1】  

(Release 3.1 notes confirm the Salesforce integration is generally available【S2】)

## Q2-pulse: PASS (Pulse Salesforce version)

> Does Pulse integrate with Salesforce? What version is required?

Answered by `groq-gpt-oss`

Yes—Nimbus Pulse integrates with Salesforce.  

- Minimum Pulse version: **4.3**【S1】  
- Partner requirement: **Salesforce API v59 or later; read-only sync of Accounts and Opportunities**【S1】  

(Feature introduced in Pulse 4.3 release notes)【S2】

## Q2-relay: PASS (Relay: not supported (T6))

> Does Relay integrate with Salesforce? What version is required?

Answered by `groq-gpt-oss`

Relay does **not** integrate with Salesforce - the integration is listed as “Not supported” with no minimum Relay version, and the only option mentioned is a community Zapier bridge that NimbusStack does not support [S1].

## Q2-ledger: PASS (Ledger: roadmap only (T6))

> Does Ledger integrate with Salesforce? What version is required?

Answered by `groq-gpt-oss`

No, Ledger does not currently integrate with Salesforce; it is listed as “coming soon” in the 2.6 roadmap with no partner requirement published yet【S1】【S2】.

## Q3-relay: PASS (Relay 4.2 release notes)

> What new features were released in v4.2 of Relay?

Answered by `groq-gpt-oss`

In v 4.2 Nimbus Relay added:

- **Request replay** - replay any request from the last 7 days against a staging endpoint (Enterprise tier)【S1】  
- **Regional routing** - a new EU endpoint (`eu.relay.nimbusstack.com`) with data residency in Frankfurt (Enterprise tier)【S1】

## Q3-pulse: PASS (No Pulse 4.2 exists (T4))

> What new features were released in v4.2 of Pulse?

Answered by `groq-gpt-oss`

I couldn't find this in the NimbusStack knowledge base.  
The sources detail new features for versions 4.1 and 4.3, but not for 4.2.

## Q4: PASS (403: Relay + Pulse steps (T5))

> A client is getting a 403 on the API. What should they check first?

Answered by `groq-gpt-oss`

- **Nimbus Pulse:** Verify that the user who owns the API key is a member of the workspace the project belongs to — that’s the first check for a 403 error [S1].

- **Nimbus Relay:** Verify that the token’s scope includes the route being called (scopes are per-route since Relay 4.0) — that’s the first check for a 403 error [S2].

## Q5: PASS (SAML: all four products, Pulse no, Vault conflict (T1, T3))

> Which of our products support SSO via SAML 2.0?

Answered by `groq-gpt-oss`

Nimbus Relay - Enterprise tier; Nimbus Vault - Pro and Enterprise tiers; Nimbus Ledger - all tiers support SAML 2.0 SSO.  

| Product | Tier(s) with SAML 2.0 SSO |
|---|---|
| Nimbus Relay | Enterprise |
| Nimbus Vault | Pro, Enterprise |
| Nimbus Ledger | Starter, Pro, Enterprise |
| Nimbus Pulse | *none* |

⚠️ **Sources disagree:**  
- **Nimbus Vault SAML 2.0 availability** - Company-wide summary lists “Enterprise only” [S2] (2026-01-15); product pricing table lists “Pro and Enterprise” [S4] (2026-07-03); release notes state “SAML 2.0 federated sign-in extended to the Pro tier” [S8] (2026-04-14).

## Q6: PASS (P1 SLA per product and tier (T7))

> What's the SLA for Priority 1 support tickets?

Answered by `groq-gpt-oss`

**Priority 1 (P1) response times per product and tier**

| Product | Starter | Pro | Enterprise |
|---|---|---|---|
| Nimbus Pulse | Next business day【S1】 | 4 hours【S1】 | 1 hour, 24×7【S1】 |
| Nimbus Vault | 4 business hours【S2】 | 1 hour【S2】 | 30 minutes, 24×7【S2】 |
| Nimbus Relay | 8 business hours【S3】 | 2 hours【S3】 | 15 minutes, 24×7【S3】 |
| Nimbus Ledger | 8 business hours【S4】 | 2 hours【S4】 | 30 minutes, 24×7【S4】 |

## E1: PASS (Follow-up resolves to Vault SLA)

> Does Vault integrate with Salesforce?
>
> What about its SLA?

Answered by `groq-gpt-oss`

Nimbus Vault’s support SLA response times are:

| Priority | Starter | Pro | Enterprise |
|---|---|---|---|
| **P1 (service down)** | 4 business hours | 1 hour | 30 minutes (24×7) |
| **P2 (degraded)** | Next business day | 4 hours | 2 hours |
| **P3 (question)** | 3 business days | 1 business day | 8 hours |
| **P4 (feature request)** | Best effort | Best effort | 5 business days |【S1】

## E2-refund: PASS (Not in KB)

> What is NimbusStack's refund policy for annual plans?

Answered by `groq-gpt-oss`

I couldn't find this in the NimbusStack knowledge base.  
The available sources cover support plans, pricing tables, and support SLA details, but do not mention a refund policy for annual plans. [S1][S2][S9]

## E2-offtopic: PASS (Off-topic)

> What is the capital of France?

Answered by `groq-gpt-oss`

I couldn't find this in the NimbusStack knowledge base.  
The knowledge base covers information about NimbusStack products such as Relay, Vault, Pulse, and Ledger.

## E3: PASS (Partial answer)

> What does Vault Pro cost per seat, and is Vault SOC 2 certified?

Answered by `groq-gpt-oss`

Vault Pro costs **$35 per seat per month** on an annual plan【S1】.  
**Not in the knowledge base:** SOC 2 certification status for Nimbus Vault.

## E4: PASS (Conflict surfaced (Vault SAML tiers))

> Does Vault Pro support SAML single sign-on?

Answered by `groq-gpt-oss`

Yes - the Pro tier of Nimbus Vault includes SAML 2.0 single sign-on. [S1][S3]

⚠️ **Sources disagree:**  
- S2 (2026-01-15) lists SAML 2.0 only for the Enterprise tier. [S2]  
- S1 (2026-07-03) and S3 (2026-04-14) show SAML 2.0 available on the Pro tier. [S1][S3]

## E4-none: PASS (No false conflict on a plain SLA lookup)

> What is the P2 SLA for Relay Pro?

Answered by `groq-gpt-oss`

The P2 SLA for Nimbus Relay Pro is **8 hours** response time to the first human reply. 【S1】

## E5: PASS (Loose wording finds SAML)

> does ledger do single sign-on?

Answered by `groq-gpt-oss`

Yes—Nimbus Ledger provides single sign-on via SAML 2.0 in every tier【S1】【S2】【S3】.

## E6-a: PASS (Exact table cell)

> What is the P2 response time for Vault Pro?

Answered by `groq-gpt-oss`

The P2 response time for Nimbus Vault Pro is **4 hours**【S1】.

## E6-b: PASS (Exact table cell)

> What is the P3 SLA for Relay Enterprise customers?

Answered by `groq-gpt-oss`

8 hours for the first human reply to a P3 (question) ticket for Relay Enterprise customers. [S1]


**20/20 passed**
