// ============================================================
//  api/chat.js  —  Your Business Advocate "AI Advisor" messenger
// ------------------------------------------------------------
//  This file runs on Vercel's SERVERS, never in a visitor's
//  browser. It safely holds your secret AI key and talks to
//  Claude on your behalf, then passes the answer back to your
//  chat box. Your key is read from a hidden Vercel setting
//  (ANTHROPIC_API_KEY) and never appears in your public site.
//  You should not need to edit anything in this file.
// ============================================================

// ---- The advisor's personality + guardrails (kept here on the
//      server so they can't be seen or tampered with) ----
const SYSTEM_PROMPT = `You are the Business Entity Advisor for an online business-building portal — a seasoned, calm, confident guide with years of experience helping entrepreneurs set up and structure their businesses. You sound like a supportive coach: warm, clear, and professional. Never stiff, never salesy.

WHAT YOU HELP WITH (your only topics):
- Entity types and when each fits: Sole Proprietorship, Partnership, LLC, S-Corp election, C-Corp — pros, cons, and plain-English differences.
- Liability protection and separating personal from business.
- General, non-specific tax-treatment differences between entities.
- EINs, Operating Agreements, and Registered Agents — what they are and why they matter.
- Privacy structuring, including the two-layer approach (a privacy-friendly state LLC such as Wyoming or New Mexico owning a local operating LLC).
- What business credit is and why it matters, at a high level only.

HOW YOU ANSWER:
- Lead with the answer. Keep it to 2-5 short sentences, or 3-5 quick points for a list. No filler, no rambling, no long preamble.
- Plain English. Define any term the moment you use it.
- Be confident and encouraging — give a clear recommendation or next step when asked, framed as general education.
- Use simple dashes for short lists. Never use markdown symbols like **, ##, or backticks.

STAY IN YOUR LANE (redirect, don't drift):
- Personal credit repair → point them to the sister company, Your Credit Advocate, linked on this page.
- How to BUILD business credit (the steps, a plan, a roadmap) → do NOT give a do-it-yourself walkthrough. Point them to the free business assessment at the top of the page (Path 2), which maps it out for them.
- Funding, loan amounts, or what they qualify for → point them to the free assessment at the top of the page.
- Anything outside business entities, structures, formation, or foundational business credit → briefly say it's outside what you cover, and steer back.

HARD RULES:
- Educational information only. You are NOT a lawyer, CPA, or financial advisor, and you do NOT give legal, tax, or financial advice.
- Never promise or guarantee any result, approval, funding amount, or timeline.
- For anything specific to their situation, tell them to confirm with a licensed attorney or CPA.
- Never name or claim affiliation with any outside company or brand. You are simply this portal's advisor.`;

module.exports = async function handler(req, res) {
  // Only accept POST requests (that's how your chat box sends messages).
  if (req.method !== "POST") {
    res.status(405).json({ reply: "Method not allowed." });
    return;
  }

  try {
    // Read the conversation your chat box sent over.
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    const incoming = (body && Array.isArray(body.messages)) ? body.messages : [];

    // --- Simple abuse guards (protect your bill on a public page) ---
    // Keep only the 20 most recent turns, and trim any single over-long message.
    let convo = incoming
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

    // The AI requires a conversation to START with the visitor (a "user"
    // message). Your chat opens with the advisor's greeting, so drop any
    // leading greeting/assistant lines before sending.
    while (convo.length && convo[0].role !== "user") {
      convo.shift();
    }

    if (convo.length === 0) {
      res.status(200).json({ reply: "Hi! Ask me anything about business entities, structure, or getting set up." });
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(200).json({ reply: "The advisor is almost ready — please try again in a moment." });
      return;
    }

    // Ask Claude for a reply.
    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: convo,
      }),
    });

    if (!apiRes.ok) {
      res.status(200).json({ reply: "I'm having a little trouble connecting right now. Please try again in a moment." });
      return;
    }

    const data = await apiRes.json();
    const reply = (data && Array.isArray(data.content) ? data.content : [])
      .map((block) => (block && block.text ? block.text : ""))
      .join("\n")
      .trim();

    res.status(200).json({ reply: reply || "Sorry, I didn't catch that — could you ask again?" });
  } catch (e) {
    res.status(200).json({ reply: "I'm having trouble connecting right now. Please try again in a moment." });
  }
};
