export async function remote() {
  return {
    $: vi.fn(),
    $$: vi.fn(),
    url: vi.fn(),
    deleteSession: vi.fn(),
  };
}
