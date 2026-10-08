# Eval results

Model: `groq-gpt-oss` · Base: http://localhost:3100 · 2026-10-08T03:31:06.313Z

## E10 blank message: PASS (HTTP 400)

## Q1: PASS (Pro vs Enterprise across products, incl. Relay $59 change (T2))

> What are the key differences between the Pro and Enterprise pricing tiers?

Answered by `groq-gpt-oss`

**Key differences between the Pro and Enterprise tiers per product**

| Product | Price (per month) | Capacity / Limits | Notable Feature Differences | Support plan |
|---|---|---|---|---|
| **Nimbus Vault** | Pro $35/seat [​S1] • Enterprise Custom/price not listed [​S1] | Secrets: 10 k (Pro) vs Unlimited (Enterprise) [​S1] | HSM-backed keys: No (Pro) vs Yes (Enterprise) [​S1]; Audit-log retention: 180 days vs 400 days [​S1] | Standard (Pro) vs Premium (Enterprise) [​S1] |
| **Nimbus Pulse** | Pro $299/workspace [​S2] • Enterprise Custom [​S2] | Monthly events: 50 M (Pro) vs Custom [​S2] | Warehouse export: Snowflake only (Pro) vs Snowflake + BigQuery (Enterprise) [​S2]; Session replay: Yes on both tiers [​S2] | Standard (Pro) vs Premium (Enterprise) [​S2] |
| **Nimbus Ledger** | Pro $199 [​S3] • Enterprise Custom [​S3] | Invoiced volume included: $500 k (Pro) vs Custom [​S3] | No tier-specific feature gaps - SAML 2.0 login, dunning, and support level are the same across tiers [​S3] | Standard (Pro) vs Premium (Enterprise) [​S3] |
| **Nimbus Relay** | Pro $49/seat [​S4] **or** $59/seat for new contracts [​S5] • Enterprise Custom [​S4] | Seats: 25 (Pro) vs Unlimited (Enterprise) [​S4]; API rate limit: 10 k req/min vs 100 k req/min [​S4] | Single sign-on: No (Pro) vs SAML 2.0 (Enterprise) [​S4]; Audit-log retention: 90 days vs 400 days [​S4]; Request replay & EU regional routing only on Enterprise [​S4] | Standard (Pro) vs Premium (Enterprise) [​S4] |

⚠️ **Sources disagree:**  
- **Relay Pro price** - $49 per seat per month in the product pricing table (S4, 2026-06-12) vs $59 per seat per month for new contracts signed on/after 1 Aug 2026 (S5, 2026-06-10). The release note is newer but specifies a conditional price change.  

**Not in the knowledge base:** any exact Enterprise price figures (all list “Custom”).

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

Yes—Nimbus Pulse integrates with Salesforce, requiring at least version 4.3 and Salesforce API v59 or later (read-only sync of Accounts and Opportunities)【S1】.  

- **Minimum Pulse version:** 4.3【S1】  
- **Partner requirement:** Salesforce API v59 or later; read-only sync of Accounts and Opportunities【S1】  
- **Release note confirmation:** Salesforce sync introduced in Pulse 4.3【S2】

## Q2-relay: PASS (Relay: not supported (T6))

> Does Relay integrate with Salesforce? What version is required?

Answered by `groq-gpt-oss`

No - Nimbus Relay does **not** integrate with Salesforce. The integration is listed as “Not supported” (no Relay version applies) and the only note is that “A community Zapier bridge exists; NimbusStack does not support it.” [S1]

## Q2-ledger: PASS (Ledger: roadmap only (T6))

> Does Ledger integrate with Salesforce? What version is required?

Answered by `groq-gpt-oss`

No, Nimbus Ledger does not currently integrate with Salesforce; it is listed as “coming soon” in the 2.6 roadmap and no partner requirement or version is published yet【S1】【S2】.

**Not in the knowledge base:** the minimum Ledger version and partner requirement for a Salesforce integration (since the integration is not yet released).

## Q3-relay: PASS (Relay 4.2 release notes)

> What new features were released in v4.2 of Relay?

Answered by `groq-gpt-oss`

v4.2 added two new features to Nimbus Relay [​S1​]:

- **Request replay** - replay any request from the last 7 days against a staging endpoint (Enterprise tier).  
- **Regional routing** - an EU endpoint (`eu.relay.nimbusstack.com`) with data residency in Frankfurt (Enterprise tier).

## Q3-pulse: PASS (No Pulse 4.2 exists (T4))

> What new features were released in v4.2 of Pulse?

Answered by `groq-gpt-oss`

I couldn't find this in the NimbusStack knowledge base.  
The available sources cover new features for versions 4.1 and 4.3, but not for 4.2.

## Q4: PASS (403: Relay + Pulse steps (T5))

> A client is getting a 403 on the API. What should they check first?

Answered by `groq-gpt-oss`

**First check for a 403 error**

| Product | First thing to verify |
|---|---|
| Nimbus Pulse | The user who owns the API key is a member of the workspace the project belongs to. [S1] |
| Nimbus Relay | The token’s scope includes the route being called. [S2] |

## Q5: FAIL (SAML: all four products, Pulse no, Vault conflict (T1, T3))

> Which of our products support SSO via SAML 2.0?

Answered by `groq-gpt-oss` · missing: /OIDC|OpenID/i

SSO via SAML 2.0 is available in Nimbus Relay (Enterprise), Nimbus Vault (Pro & Enterprise), and Nimbus Ledger (all tiers); Nimbus Pulse does not support it.  

| Product | Tier(s) with SAML 2.0 |
|---|---|
| Nimbus Relay | Enterprise [​S7] |
| Nimbus Vault | Pro, Enterprise [​S4] |
| Nimbus Ledger | Starter, Pro, Enterprise [​S5] |
| Nimbus Pulse | None (SAML 2.0 on roadmap) [​S1] |

⚠️ **Sources disagree:**  
- S2 (2026-01-15) lists SAML 2.0 for Nimbus Vault only on Enterprise [​S2].  
- S4 (2026-07-03) lists SAML 2.0 for Nimbus Vault on both Pro and Enterprise [​S4].  

The later pricing table (S4) reflects the updated support.  

## Q6: PASS (P1 SLA per product and tier (T7))

> What's the SLA for Priority 1 support tickets?

Answered by `groq-gpt-oss`

**Priority 1 (P1) first-human-reply SLA varies by product and tier:**  

| Product | Tier | P1 SLA |
|---|---|---|
| Nimbus Pulse | Growth | Next business day【S1】 |
| Nimbus Pulse | Pro | 4 hours【S1】 |
| Nimbus Pulse | Enterprise | 1 hour, 24×7【S1】 |
| Nimbus Vault | Starter | 4 business hours【S2】 |
| Nimbus Vault | Pro | 1 hour【S2】 |
| Nimbus Vault | Enterprise | 30 minutes, 24×7【S2】 |
| Nimbus Relay | Starter | 8 business hours【S3】 |
| Nimbus Relay | Pro | 2 hours【S3】 |
| Nimbus Relay | Enterprise | 15 minutes, 24×7【S3】 |
| Nimbus Ledger | Starter | 8 business hours【S4】 |
| Nimbus Ledger | Pro | 2 hours【S4】 |
| Nimbus Ledger | Enterprise | 30 minutes, 24×7【S4】 |

## E1: PASS (Follow-up resolves to Vault SLA)

> Does Vault integrate with Salesforce?
>
> What about its SLA?

Answered by `groq-gpt-oss`

Nimbus Vault’s support SLA specifies the first-human-reply times by priority and tier:

| Priority | Starter | Pro | Enterprise |
|---|---|---|---|
| P1 (service down) | 4 business hours | 1 hour | 30 minutes, 24×7 |
| P2 (degraded) | Next business day | 4 hours | 2 hours |
| P3 (question) | 3 business days | 1 business day | 8 hours |
| P4 (feature request) | Best effort | Best effort | 5 business days |

[Source: S1]

## E2-refund: PASS (Not in KB)

> What is NimbusStack's refund policy for annual plans?

Answered by `groq-gpt-oss`

I couldn't find this in the NimbusStack knowledge base.  
The available sources cover support plans, pricing tables, and support SLA details, but none mention a refund policy for annual plans.

## E2-offtopic: PASS (Off-topic)

> What is the capital of France?

Answered by `groq-gpt-oss`

I couldn't find this in the NimbusStack knowledge base.  
The knowledge base covers NimbusStack product details, not geographic information.

## E3: PASS (Partial answer)

> What does Vault Pro cost per seat, and is Vault SOC 2 certified?

Answered by `groq-gpt-oss`

Vault Pro costs **$35 per seat per month** on an annual plan【S1】.

**Not in the knowledge base:** information on whether Vault is SOC 2 certified.

## E4: PASS (Conflict surfaced (Vault SAML tiers))

> Does Vault Pro support SAML single sign-on?

Answered by `groq-gpt-oss`

Yes - Vault Pro includes SAML 2.0 single sign-on. [S1][S3]  

⚠️ **Sources disagree:**  
- S2 (2026-01-15) lists SAML 2.0 only on the Enterprise tier. [S2]  
- S1 (2026-07-03) and S3 (2026-04-14) show SAML 2.0 available on the Pro tier. [S1][S3]  

## E5: PASS (Loose wording finds SAML)

> does ledger do single sign-on?

Answered by `groq-gpt-oss`

Yes—Nimbus Ledger provides single sign-on via SAML 2.0 on every tier【S1】【S2】【S3】.

## E6-a: PASS (Exact table cell)

> What is the P2 response time for Vault Pro?

Answered by `groq-gpt-oss`

The P2 response time for Vault Pro is **4 hours**【S1】.

## E6-b: PASS (Exact table cell)

> What is the P3 SLA for Relay Enterprise customers?

Answered by `groq-gpt-oss`

The P3 SLA for Relay Enterprise customers is a response within **8 hours**.【S1】


**18/19 passed**
