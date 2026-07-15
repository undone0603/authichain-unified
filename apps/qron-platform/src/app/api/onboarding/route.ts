import { NextRequest, NextResponse } from 'next/server';

const ONBOARDING_STEPS = [
  {
    id: 'create_account',
    title: 'Create your account',
    description: 'Sign up and verify your email address.',
    required: true,
    category: 'setup',
  },
  {
    id: 'create_first_qr',
    title: 'Create your first QR code',
    description: 'Generate a dynamic QR code and customize it to match your brand.',
    required: true,
    category: 'core',
  },
  {
    id: 'scan_test',
    title: 'Test your QR code',
    description: 'Scan your QR code with a mobile device to confirm it works.',
    required: true,
    category: 'core',
  },
  {
    id: 'view_analytics',
    title: 'Explore scan analytics',
    description: 'Check the analytics dashboard to see scan data and geographic insights.',
    required: false,
    category: 'analytics',
  },
  {
    id: 'apply_ai_style',
    title: 'Apply an AI style',
    description: 'Transform your QR code into AI-generated art using one of our style presets.',
    required: false,
    category: 'design',
  },
  {
    id: 'create_campaign',
    title: 'Set up a campaign',
    description: 'Group your QR codes into a campaign and track aggregate performance.',
    required: false,
    category: 'campaigns',
  },
  {
    id: 'install_integration',
    title: 'Connect an integration',
    description: 'Connect QRON to Slack, HubSpot, Zapier, or another platform.',
    required: false,
    category: 'integrations',
  },
  {
    id: 'invite_team',
    title: 'Invite a team member',
    description: 'Collaborate by inviting your colleagues to your QRON workspace.',
    required: false,
    category: 'team',
  },
  {
    id: 'connect_domain',
    title: 'Connect a custom domain',
    description: 'Use your own domain for QR redirect links instead of qron.space.',
    required: false,
    category: 'branding',
  },
  {
    id: 'add_api_key',
    title: 'Generate an API key',
    description: 'Access QRON programmatically by generating an API key.',
    required: false,
    category: 'developer',
  },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');
  const completed_steps = searchParams.get('completed')?.split(',') || [];

  if (!user_id) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  const steps_with_status = ONBOARDING_STEPS.map((step) => ({
    ...step,
    completed: completed_steps.includes(step.id),
  }));

  const required_steps = steps_with_status.filter((s) => s.required);
  const optional_steps = steps_with_status.filter((s) => !s.required);
  const completed_count = steps_with_status.filter((s) => s.completed).length;
  const required_complete = required_steps.every((s) => s.completed);
  const next_step = steps_with_status.find((s) => !s.completed) || null;

  return NextResponse.json({
    success: true,
    user_id,
    progress: {
      completed: completed_count,
      total: ONBOARDING_STEPS.length,
      percent: Math.round((completed_count / ONBOARDING_STEPS.length) * 100),
      required_complete,
    },
    next_step,
    required_steps,
    optional_steps,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { user_id, step_id } = body;

  if (!user_id || !step_id) {
    return NextResponse.json({ error: 'user_id and step_id are required' }, { status: 400 });
  }

  const step = ONBOARDING_STEPS.find((s) => s.id === step_id);
  if (!step) {
    return NextResponse.json(
      { error: `Invalid step_id. Valid steps: ${ONBOARDING_STEPS.map((s) => s.id).join(', ')}` },
      { status: 422 }
    );
  }

  return NextResponse.json({
    success: true,
    user_id,
    step_id,
    step_title: step.title,
    message: `Step "${step.title}" marked as complete.`,
    completed_at: new Date().toISOString(),
  });
}
