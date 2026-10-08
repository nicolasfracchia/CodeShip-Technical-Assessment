# Eval results

Model: `gemini-flash` · Base: http://localhost:3100 · 2026-10-08T02:50:04.831Z

## E10 blank message: PASS (HTTP 400)

## Q1: PASS (Pro vs Enterprise across products, incl. Relay $59 change (T2))

> What are the key differences between the Pro and Enterprise pricing tiers?

Answered by `gemini-flash`

The key differences between the Pro and Enterprise pricing tiers across NimbusStack products are detailed below:

### Nimbus Vault
* **Price:** Pro is $35 per seat/month on an annual plan [S1] vs. Enterprise which is Custom [S1].
* **Secrets:** Pro includes 10,000 secrets vs. Enterprise which includes Unlimited [S1].
* **HSM-backed keys:** Pro does not include HSM-backed keys [S1] vs. Enterprise which does [S1][S6].
* **Audit log retention:** Pro has 180 days of retention vs. Enterprise which has 400 days [S1].
* **Support plan:** Pro includes the Standard support plan vs. Enterprise which includes Premium [S1].

### Nimbus Pulse
* **Price:** Pro is $299 per workspace/month on an annual plan [S2] vs. Enterprise which is Custom [S2].
* **Monthly events:** Pro includes 50 million events vs. Enterprise which is Custom [S2].
* **Warehouse export:** Pro supports Snowflake export only vs. Enterprise which supports both Snowflake and BigQuery [S2].
* **Support plan:** Pro includes the Standard support plan vs. Enterprise which includes Premium [S2].

### Nimbus Ledger
* **Price:** Pro is $199/month on an annual plan (plus 0.5% of invoiced volume) [S3] vs. Enterprise which is Custom [S3].
* **Invoiced volume included:** Pro includes $500,000 of invoiced volume vs. Enterprise which is Custom [S3].
* **Support plan:** Pro includes the Standard support plan vs. Enterprise which includes Premium [S3].

### Nimbus Relay
* **Price:** Pro is $49 per seat/month on an annual plan (subject to change, see below) [S4] vs. Enterprise which is Custom [S4].
* **Included seats:** Pro includes 25 seats vs. Enterprise which is Unlimited [S4].
* **API rate limit:** Pro is limited to 10,000 req/min vs. Enterprise which is limited to 100,000 req/min [S4].
* **Single sign-on:** Pro does not include single sign-on vs. Enterprise which includes SAML 2.0 [S4][S7].
* **Audit log retention:** Pro has 90 days of retention vs. Enterprise which has 400 days [S4].
* **Request replay:** Pro does not support request replay vs. Enterprise which does [S4][S5].
* **Regional routing:** Pro is restricted to US only vs. Enterprise which supports US and EU routing [S4][S5].
* **Support plan:** Pro includes the Standard support plan vs. Enterprise which includes Premium [S4].

---

⚠️ **Sources disagree:**
* **Nimbus Vault Single Sign-On:** The product documentation [S1] (dated 2026-07-03) and release notes [S6] (dated 2026-04-14) state that SAML 2.0 is available on both the Pro and Enterprise tiers. However, the company-wide security overview [S7] (dated 2026-01-15) states that SAML 2.0 is only available on the Enterprise tier for Nimbus Vault.
* **Nimbus Relay Pro Price:** The product documentation [S4] (dated 2026-06-12) lists the Pro price as $49 per seat per month. However, the release notes [S5] (dated 2026-06-10) state that the Pro tier price changes to $59 per seat per month for new contracts signed on or after 1 August 2026.

## Q2-vault: PASS (Vault Salesforce version)

> Does Vault integrate with Salesforce? What version is required?

Answered by `gemini-flash`

Yes, Nimbus Vault integrates with Salesforce, and it requires Vault version 3.1 or later [S1][S2]. 

* **Minimum Vault Version:** 3.1 [S1][S2]
* **Partner Requirement:** Salesforce API v58 or later, and a Connected App with the `api` scope [S1]

## Q2-pulse: PASS (Pulse Salesforce version)

> Does Pulse integrate with Salesforce? What version is required?

Answered by `gemini-flash`

Yes, Nimbus Pulse integrates with Salesforce, and it requires a minimum Pulse version of 4.3 [S1][S2]. 

* **Partner Requirement:** Salesforce API v59 or later is required for a read-only sync of Accounts and Opportunities [S1].
* **Functionality:** Accounts and Opportunities appear as user properties in Pulse [S2].

## Q2-relay: PASS (Relay: not supported (T6))

> Does Relay integrate with Salesforce? What version is required?

Answered by `gemini-flash`

Nimbus Relay does not support integration with Salesforce [S1]. 

* **Required Version:** Not supported (though a community Zapier bridge exists, NimbusStack does not support it) [S1].

## Q2-ledger: PASS (Ledger: roadmap only (T6))

> Does Ledger integrate with Salesforce? What version is required?

Answered by `gemini-flash`

Nimbus Ledger does not currently integrate with Salesforce, as the integration is planned for a later release [S1][S2]. 

* **Integration Status:** Listed as "coming soon" on the roadmap [S1] and planned for a later release [S2].
* **Version Required:** A specific required version has not been established, though it was listed on the 2.6 roadmap [S1] and subsequently noted as planned for a later release in the 2.6 release notes [S2].
* **Partner Requirement:** Not yet published [S1].

## Q3-relay: PASS (Relay 4.2 release notes)

> What new features were released in v4.2 of Relay?

Answered by `gemini-flash`

In Nimbus Relay v4.2, the following new features and pricing changes were released:

*   **Request replay:** Replay any request from the last 7 days against a staging endpoint (Enterprise tier) [S1].
*   **Regional routing:** An EU endpoint (`eu.relay.nimbusstack.com`) with data residency in Frankfurt (Enterprise tier) [S1].
*   **Pro tier pricing changes:** Pro tier pricing changes to $59 per seat per month for new contracts signed on or after 1 August 2026 (existing contracts maintain their current price until renewal) [S1].

## Q3-pulse: PASS (No Pulse 4.2 exists (T4))

> What new features were released in v4.2 of Pulse?

Answered by `gemini-flash`

I couldn't find this in the NimbusStack knowledge base. The knowledge base does not contain release notes for version 4.2, but it does cover release notes for Nimbus Pulse versions 4.1 [S1] and 4.3 [S2].

## Q4: PASS (403: Relay + Pulse steps (T5))

> A client is getting a 403 on the API. What should they check first?

Answered by `gemini-flash`

What to check first for a 403 Forbidden API error depends on the product being used:

* **Nimbus Pulse**: Check that the user who owns the API key is a member of the workspace the project belongs to [S1].
* **Nimbus Relay**: Check that the token's scope includes the route being called [S2].
* **Nimbus Vault**: Troubleshooting for 403 errors is not documented in the sources [S3][S6].
* **Nimbus Ledger**: Troubleshooting for 403 errors is not documented in the sources [S7][S8].

## Q5: PASS (SAML: all four products, Pulse no, Vault conflict (T1, T3))

> Which of our products support SSO via SAML 2.0?

Answered by `gemini-flash`

SAML 2.0 single sign-on (SSO) support varies by product:

*   **Nimbus Ledger**: Supports SAML 2.0 on all tiers (Starter, Pro, and Enterprise) [S2][S5][S6].
*   **Nimbus Relay**: Supports SAML 2.0 on the Enterprise tier only [S2][S3][S7].
*   **Nimbus Vault**: Supports SAML 2.0 on the Pro and Enterprise tiers [S4][S8] (see source disagreement below).
*   **Nimbus Pulse**: Does not support SAML 2.0; it is currently on the roadmap and not available [S1]. It supports OpenID Connect (OIDC) on Pro and Enterprise [S1][S2].

⚠️ **Sources disagree:**
*   For **Nimbus Vault**, the company-wide security overview [S2] (dated 2026-01-15) states SAML 2.0 is supported on "Enterprise" only. However, the more recent product pricing [S4] (dated 2026-07-03) and release notes [S8] (dated 2026-04-14) state that SAML 2.0 is supported on both the Pro and Enterprise tiers, having been extended to the Pro tier in version 3.1.

## Q6: PASS (P1 SLA per product and tier (T7))

> What's the SLA for Priority 1 support tickets?

Answered by `gemini-flash`

The Priority 1 (P1) support SLA response times vary by product and tier:

**Nimbus Pulse** [S1]:
* Growth tier (Priority 1): Next business day [S1]
* Pro tier (Priority 1): 4 hours [S1]
* Enterprise tier (Priority 1): 1 hour, 24x7 [S1]

**Nimbus Vault** [S2]:
* Starter tier (Priority 1): 4 business hours [S2]
* Pro tier (Priority 1): 1 hour [S2]
* Enterprise tier (Priority 1): 30 minutes, 24x7 [S2]

**Nimbus Relay** [S3]:
* Starter tier (Priority 1): 8 business hours [S3]
* Pro tier (Priority 1): 2 hours [S3]
* Enterprise tier (Priority 1): 15 minutes, 24x7 [S3]

**Nimbus Ledger** [S4]:
* Starter tier (Priority 1): 8 business hours [S4]
* Pro tier (Priority 1): 2 hours [S4]
* Enterprise tier (Priority 1): 30 minutes, 24x7 [S4]

## E1: PASS (Follow-up resolves to Vault SLA)

> Does Vault integrate with Salesforce?
>
> What about its SLA?

Answered by `groq-gpt-oss`

Nimbus Vault SLA (response time to first human reply):

| Priority | Starter | Pro | Enterprise |
|---|---|---|---|
| **P1** (service down) | 4 business hours | 1 hour | 30 minutes, 24×7 |
| **P2** (degraded) | Next business day | 4 hours | 2 hours |
| **P3** (question) | 3 business days | 1 business day | 8 hours |
| **P4** (feature request) | Best effort | Best effort | 5 business days |

Source: [S1]

## E2-refund: PASS (Not in KB)

> What is NimbusStack's refund policy for annual plans?

Answered by `groq-gpt-oss`

I couldn't find this in the NimbusStack knowledge base. The available sources cover pricing, support plans, business hours, troubleshooting, features, and support SLAs, but do not include a refund policy.

## E2-offtopic: PASS (Off-topic)

> What is the capital of France?

Answered by `groq-gpt-oss`

I couldn't find this in the NimbusStack knowledge base. The knowledge base covers product details for Nimbus Relay, Nimbus Vault, Nimbus Pulse, and Nimbus Ledger.

## E3: PASS (Partial answer)

> What does Vault Pro cost per seat, and is Vault SOC 2 certified?

Answered by `groq-gpt-oss`

Vault Pro costs **$35 per seat per month on an annual plan**【S1】.

**Not in the knowledge base:** information about Vault’s SOC 2 certification.

## E4: FAIL (Conflict surfaced (Vault SAML tiers))

> Does Vault Pro support SAML single sign-on?

Answered by `groq-gpt-oss` · missing: /disagree|conflict/i, /2026-01-15|security overview/i

Yes, Nimbus Vault Pro supports SAML 2.0 single sign-on. [S1][S3]

## E5: PASS (Loose wording finds SAML)

> does ledger do single sign-on?

Answered by `groq-gpt-oss`

Yes, Nimbus Ledger supports single sign-on via federated login (SAML 2.0) on every tier【S1】【S2】【S3】.

## E6-a: PASS (Exact table cell)

> What is the P2 response time for Vault Pro?

Answered by `groq-gpt-oss`

The P2 response time for Vault Pro is **4 hours**【S1】.

## E6-b: PASS (Exact table cell)

> What is the P3 SLA for Relay Enterprise customers?

Answered by `groq-gpt-oss`

8 hours for P3 (question) incidents for Relay Enterprise customers. 【S1】


**18/19 passed**
