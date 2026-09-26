let meta = #{
    name: "revenue-cycle",
    description: "Run the AuthiChain revenue operator cycle without sending mail",
    when_to_use: "Revenue goal, subscriber check, founder payout, wait-buyer",
    phases: [
        #{ title: "Rails", detail: "Farm Payment Link 200 and Farm HEAD 204" },
        #{ title: "Decide", detail: "classifyRevenue; wait-buyer unless a stranger paid" },
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
    },
};

phase("Rails");
let rails_prompt = "";
rails_prompt += "Check AuthiChain Farm rails with read-only HTTP. ";
rails_prompt += "GET the strainchain_farm Payment Link from src/lib/plans.ts and expect 200. ";
rails_prompt += "HEAD https://authichain.com/api/checkout/plan/strainchain_farm and expect 204. ";
rails_prompt += "Do not GET /api/checkout/dpp. Do not GET farm checkout with an email. ";
rails_prompt += "Do not send mail. Return {ok, reason}.";
let rails = agent(rails_prompt, #{
    label: "farm-rails",
    capability_mode: "read-only",
    output_schema: rails_schema,
});

phase("Decide");
let decide_prompt = "";
decide_prompt += "You are the AuthiChain revenue operator. ";
decide_prompt += "Use classifyRevenue / decideOperatorAction in scripts/revenue-operator.ts. ";
decide_prompt += "A founder charge (undone.k@gmail.com, authichain@gmail.com, the $10 self-test) is not revenue. ";
decide_prompt += "Do not send email. Do not dispatch b2b-outreach, outreach-trigger, dpp-outreach-trigger, pipeline-tick, or gov-mint. ";
decide_prompt += "Do not set REQUIRE_OUTREACH_APPROVAL=false. ";
if args != () && args.snapshot != () {
    decide_prompt += " Classify this snapshot JSON: " + json_encode(args.snapshot);
} else {
    decide_prompt += " No snapshot was passed. Action must be wait_buyer unless you independently read live Stripe and found a non-founder subscription or payout.";
}
decide_prompt += " Return {action, reason} where action is one of fix_rails, qualifying, wait_buyer, refuse_send.";
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
if rails != () && rails.success && rails.output.ok == false {
    action = "fix_rails";
    if rails.output.reason != () {
        reason = rails.output.reason;
    }
}

complete(#{ action: action, reason: reason, sent: false });
