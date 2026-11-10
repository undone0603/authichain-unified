let meta = #{
    name: "revenue-cycle",
    description: "Read-only AuthiChain and Signal revenue readiness without sales or charges",
    when_to_use: "Outside income goal, subscriber check, verified first buyer, wait-buyer",
    phases: [
        #{ title: "Rails", detail: "Starter/DPP and Signal discovery read-only" },
        #{ title: "Decide", detail: "Source-specific settled outside + fulfillment proof" },
    ],
};

let rails_schema = #{
    "type": "object",
    "required": ["ok", "reason"],
    "properties": #{
        "ok": #{ "type": "boolean" },
        "reason": #{ "type": "string" },
    },
};

let decide_schema = #{
    "type": "object",
    "required": ["action", "reason"],
    "properties": #{
        "action": #{ "type": "string" },
        "reason": #{ "type": "string" },
        "evidenceVerified": #{ "type": "boolean" },
        "fulfillmentVerified": #{ "type": "boolean" },
        "independentBuyerVerified": #{ "type": "boolean" },
        "evidenceRefs": #{ "type": "string" },
        "observedAtUtc": #{ "type": "string" },
    },
};

phase("Rails");
let rails_prompt = "";
rails_prompt += "Check the public, no-charge revenue surfaces with read-only HTTP. ";
rails_prompt += "GET https://authichain.com/checkout/starter and /checkout/dpp_readiness expect 200. ";
rails_prompt += "GET the Starter Payment Link from src/lib/plans.ts expect 200. ";
rails_prompt += "HEAD https://authichain.com/api/checkout/dpp expect 204; never GET that API. ";
rails_prompt += "GET https://signal.authichain.com/offer expect 200 and /api/x402/discovery expect 402. ";
rails_prompt += "Read their TAPE / PEPKIN 0.01 USDC (10000 atomic) discovery claims, not the legacy 50000 pass. ";
rails_prompt += "GET https://signal.authichain.com/health.live expect idle sku discovery / 10000. ";
rails_prompt += "Never POST or pay, never send, never create a checkout session. ";
rails_prompt += "If network evidence is missing, return ok=false and say unknown. Return {ok, reason}.";
let rails = agent(rails_prompt, #{
    label: "farm-rails",
    capability_mode: "read-only",
    output_schema: rails_schema,
});

phase("Decide");
let decide_prompt = "";
decide_prompt += "You are the AuthiChain revenue operator. ";
decide_prompt += "Use classifyRevenue / decideOperatorAction in scripts/revenue-operator.ts for triage only. ";
decide_prompt += "Legacy active Stripe subscriptions are NOT paid renewal proof. ";
decide_prompt += "Independently verify matched live paid invoice or positive settled Checkout, signed webhook, and fulfilled entitlement before declaring AuthiChain revenue. ";
decide_prompt += "For Signal use only a fresh revenue.outside read with independent buyer attribution, settled X-Payment-Tx, TAPE fulfillment and actual costs. ";
decide_prompt += "Do not merge Signal USDC with AuthiChain Stripe figures. ";
decide_prompt += "A founder charge (undone.k@gmail.com, authichain@gmail.com, the $10 self-test) is not revenue. ";
decide_prompt += "Do not send email. Do not dispatch b2b-outreach, outreach-trigger, dpp-outreach-trigger, pipeline-tick, or gov-mint. ";
decide_prompt += "Do not set REQUIRE_OUTREACH_APPROVAL=false. ";
if args != () && args.snapshot != () {
    decide_prompt += " Classify this snapshot JSON: " + json_encode(args.snapshot);
} else {
    decide_prompt += " No snapshot was passed. Action must be wait_buyer unless fresh independently attributable paid AND fulfilled evidence is read from authoritative sources.";
}
decide_prompt += " Prioritise free inbound distribution if outside revenue remains unknown. Never email, post, spend, deploy, or charge. ";
decide_prompt += " Return {action, reason, evidenceVerified, fulfillmentVerified, independentBuyerVerified, evidenceRefs, observedAtUtc}. ";
decide_prompt += " Set every evidence flag false unless you personally confirmed provider-side settlement, actual fulfillment and independent buyer attribution from authoritative fresh sources. ";
decide_prompt += " evidenceRefs must cite provider and fulfillment sources, not 402 discovery or the operator snapshot. ";
let decision = agent(decide_prompt, #{
    label: "decide",
    capability_mode: "read-only",
    output_schema: decide_schema,
});

let action = "wait_buyer";
let reason = "no decision";
if decision != () && decision.success && decision.output.action != () {
    action = decision.output.action;
    if decision.output.reason != () {
        reason = decision.output.reason;
    }
}
// A legacy subscription classifier is NOT a financial proof gate.
if action == "qualifying" {
    let proved = false;
    if decision != () && decision.success && decision.output != () {
        let d = decision.output;
        if d.evidenceVerified == true && d.fulfillmentVerified == true &&
           d.independentBuyerVerified == true && d.evidenceRefs != () &&
           d.evidenceRefs != "" && d.observedAtUtc != () &&
           d.observedAtUtc != "" {
            proved = true;
        }
    }
    if proved == false {
        action = "wait_buyer";
        reason = "Cannot qualify: fresh outside settlement + fulfillment + independent buyer proof absent";
    }
}

if rails != () && rails.success && rails.output.ok == false {
    action = "fix_rails";
    if rails.output.reason != () {
        reason = rails.output.reason;
    }
}

complete(#{ action: action, reason: reason, sent: false, charged: false, deployed: false });
