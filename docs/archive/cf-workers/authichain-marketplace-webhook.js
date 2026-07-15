--37821d51ce8e3e0288ae924221829646fcb645b8396ab9e64bc2e68cf0cb
Content-Disposition: form-data; name="worker.js"

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    // Only accept POST requests to /github/marketplace
    if (url.pathname !== "/github/marketplace") {
      return new Response("Not Found", { status: 404 })
    }

    if (request.method !== "POST") {
      return new Response("OK", { status: 200 })
    }

    // --- Signature Validation ---
    const signature = request.headers.get("X-Hub-Signature-256")
    const body = await request.text()

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(env.GITHUB_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )

    const expected = await crypto.subtle.sign("HMAC", key, encoder.encode(body))
    const expectedHex = [...new Uint8Array(expected)]
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")

    const expectedSig = `sha256=${expectedHex}`

    if (signature !== expectedSig) {
      console.log("Invalid signature", { signature, expectedSig })
      return new Response("Invalid signature", { status: 401 })
    }

    const event = request.headers.get("X-GitHub-Event")
    const delivery = request.headers.get("X-GitHub-Delivery")

    console.log("GitHub Marketplace Event", {
      event,
      delivery,
      signature,
      body
    })

    return new Response("OK", { status: 200 })
  },

  async scheduled(event, env, ctx) {
    console.log("Running revenue cron…")
  }
}
--37821d51ce8e3e0288ae924221829646fcb645b8396ab9e64bc2e68cf0cb--
