// scripts/report-failure.ts
async function reportFailure() {
  const payload = {
    channel: process.env.SLACK_CHANNEL_ID!,
    text: '🚨 GovChain Lead-Gen Pipeline Failed',
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🚨 Gov-Engine Workflow Failed', emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Workflow run failed.* Please review the logs and fix before next scheduled run.\n\n<${process.env.WORKFLOW_RUN_URL}|View Workflow Run →>`,
        },
      },
    ],
  };

  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });
}

await reportFailure();
process.exit(0);
