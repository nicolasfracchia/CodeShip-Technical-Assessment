T E C H N I CA L A S S E S S M E N T 

**A C O D E S H I P AS S E S S M E N T** 

# **Internal Product Knowledge Chatbot.** 

#### **One hour. Your tools. Ship what matters.** 

A real client brief, a supplied knowledge base, and not enough time to do all of it. We want to see what you ship in an hour with your full stack, and how you decided what came first. 

**60 min Any 1 of your time** to build it **tools, models and agents** you **rule** : every answer comes from use in real work the documents 

###### **W H AT YO U S U B M I T** 

**H OW TO A P P R OAC H I T** 

- **›** A **live deployment** link 

- **›** The **GitHub repo** , which runs by following its README 

   - **›** Using AI is **expected** . You can't build this by hand in an hour 

   - **›** Your **stack** , your choice 

- **›** No write-up. You explain your work on a **followup call** 

- **›** You won't finish everything. **Choose what to build first** 

**Senior AI-Native Engineer** 

**NimbusStack** 

**60 minutes** 

**CLIENT (FICTIONAL)** 

**ROLE** 

**TIME** 

**HOW THIS WORKS** 

## **What you can ship in an hour, and how you think.** 

**Stack: your choice.** Language, framework, storage, AI SDKs. Use what you would use on a real client project. Your choices are part of what we assess. 

**We don't expect you to finish everything.** Decide what matters most and build that first. 

###### **Your deliverables** 

**SEND WHEN YOU'RE DONE** 

###### **1. A live deployment link** 

Deploy it anywhere (Vercel, Netlify, Render, Railway, etc.) and send us a working URL. We test it with our own questions before the call. 

###### **2. The GitHub repo** 

Make it public. We will clone it on a fresh machine and follow the README step by step, so make sure it works. 

###### **3. A follow-up call** 

Scheduled after you submit. You walk us through what you built and how you built it. Have two providers working for the call (free tiers are fine) so you can show the fallback. 

**Two things fail the assessment automatically:** an API key visible in the browser, and answers that don't come from the documents. Everything else costs points, not the assessment. 

**Send both links** by replying to the email that brought you this brief and the knowledge base. You don't need to send a write-up, slides or a video. 

###### **KNOWLEDGE BASE** 

##### **1** 

#### **We supply it. Treat it like a real client's documents.** 

The knowledge base comes with this brief as a folder of markdown files: documentation for four NimbusStack products, plus two company-wide documents. Treat it like a real client's documents: **use it as it is, and expect at least one place where two documents disagree.** Don't edit the files. 

###### **THE ONE RULE** 

**Every answer must come from these documents. If the answer isn't in the knowledge base, the chatbot must say so clearly instead of guessing. Answers that don't come from the documents fail the assessment automatically.** 

**2 / 5** 

**CODESHIP · TECHNICAL ASSESSMENT** 

#### **THE CLIENT BRIEF 2 NimbusStack's product knowledge is scattered.** 

NimbusStack (1,100 employees across Sales, Support, Operations and Engineering) sells four SaaS products, each with its own features, pricing tiers, integration specs and release notes. Product knowledge is scattered across wikis, PDF manuals and email threads. **A single product question takes 10 to 20 minutes to research** , different documents give conflicting answers, and non-technical staff cannot find the right document at all. Customer-facing employees end up giving inaccurate product information on live calls. 

**Build an internal chatbot:** employees ask questions about NimbusStack products in plain English and get accurate answers based only on the company's own documents. Users can pick which AI provider answers, and see how many tokens each answer used and what it cost. 

###### **Sarah** 

###### **SALES EXECUTIVE** 

Pricing, feature comparisons, compatibility, during live customer calls. Fast, skimmable, cited. 

###### **James** 

**SUPPORT ENGINEER** 

Exact technical specs, integration versions, troubleshooting steps, without reading 80-page PDFs. 

###### **Nina** 

**PRODUCT TRAINER** 

Trustworthy, current answers to onboard new hires without maintaining decks by hand. 

###### **REPRESENTATIVE QUESTIONS** 

**3** 

#### **Your chatbot must answer all six.** 

- **Q1 "What are the key differences between the Pro and Enterprise pricing tiers?"** Comparison 

- **Q2 "Does [product] integrate with Salesforce? What version is required?"** One fact plus a version requirement 

- **Q3 "What new features were released in v4.2 of [product]?"** Release notes for one specific version 

- **Q4 "A client is getting a 403 on the API. What should they check first?"** Troubleshooting 

- **Q5 "Which of our products support SSO via SAML 2.0?"** One fact from every product; the answer must be complete 

- **Q6 "What's the SLA for Priority 1 support tickets?"** Table lookup; keep the answer separate for each tier 

**3 / 5** 

**CODESHIP · TECHNICAL ASSESSMENT** 

**FUNCTIONAL REQUIREMENTS** 

**4** 

#### **What the build has to do.** 

Items marked **SHOULD** are recommended, not required. 

###### **R1** 

###### **Chat experience** 

A clean chat page in the browser. Replies **stream in word by word** as they are generated. The chat remembers earlier messages, so follow-up questions work without the user repeating the product or topic. A "New Conversation" button starts over. 

###### **R2** 

###### **Grounding** 

Find the relevant parts of the documents before calling the AI model. Every answer **shows the passages it came from** so users can check it. 

###### **R3** 

###### **Model switching** 

A dropdown to switch between **Claude, OpenAI and Gemini** at any time; each option shows the provider's name and a short description. Model details (descriptions, prices, context window sizes, fallback order) **come from a config file, not hard-coded values** . Switching keeps the conversation, and the next reply comes from the newly chosen model. 

If the main provider is down, **switch to a backup provider automatically** . Use your own API keys. At least one provider must work on your live link; free tiers are fine. A placeholder for the others is okay, tell us on the call. Expect to spend a few dollars on API credits; Gemini's free tier costs nothing. 

###### **R4** 

###### **Usage tracking** 

For each message: input tokens, output tokens, and estimated cost for the model that answered. Running totals for the session, updated after every message. 

> **SHOULD** Warn the user as the conversation gets close to the model's context-window limit (amber at 75%, red at 90%), and update the warning when they switch models. 

> **SHOULD** Let the user export the session's usage as CSV or JSON. 

###### **R5** 

###### **Backend** 

Chat requests go through your server, so **API keys never reach the browser** . Replies stream to the browser. Each finished reply includes its usage (tokens, cost), its source passages, and **the model that actually answered** , which can differ from the one selected if the backup provider was used. Handle rate limits, login/key errors and unavailable providers without crashing. 

**4 / 5** 

**CODESHIP · TECHNICAL ASSESSMENT** 

**EDGE CASES** 

##### **5** 

#### **Ten tricky cases your chatbot must handle.** 

- **E1** A follow-up that doesn't name the product ("what about its SLA?") is answered for the right product and topic, based on the earlier messages. 

- **E2** If the answer isn't in any document, the chatbot clearly says it isn't in the knowledge base and makes nothing up. 

- **E3** If only part of a question can be answered, answer that part and say plainly what the documents don't cover. 

- **E4** If the answer depends on documents that disagree, point out the disagreement and cite both sources. Don't quietly pick one. 

- **E5** Loosely worded questions ("does it do single sign-on?") still find the SAML and SSO information. 

- **E6** A question about one value in a table (one tier, one priority) gets the value from the right row, not the row next to it. 

- **E7 SHOULD** If the user switches mid-conversation to a model with a smaller context window, the warning updates right away. This only applies if you built the R4 warning. 

- **E8** If a provider fails mid-conversation, the backup provider answers, the reply shows which model answered, and the user never sees output from two models mixed together. 

- **E9** If a provider is rate-limited, the user sees a clear message that says what to do, not a frozen screen or a stack trace. 

- **E10** An empty or blank message is handled without calling any AI provider. 

###### **NOT REQUIRED** 

**6** 

#### **What you can leave out.** 

You don't need to build: a login for the app, prompt caching to cut costs, saving chats between sessions, a screen for editing the knowledge base, or admin analytics. **You can add any of them if you think it's worth it and can explain why.** 

- **If something in this brief is unclear:** some parts are left open on purpose. Make a sensible decision, note it, and explain it on the call. It doesn't need to be perfect. 

**YOUR HOUR** 

### **Read it. Decide what matters. Ship it.** 

**We care about what you ship and whether you can explain the decisions behind it.** 

**5 / 5** 

**CODESHIP · TECHNICAL ASSESSMENT** 

