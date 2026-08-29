import { describe, it, expect, vi } from 'vitest';
import { generate_opening_hook } from '/home/zac/authichain-unified/agentz/core/marketing';
import * as llmModule from '/home/zac/authichain-unified/agentz/core/llm';

describe('Outreach Intelligence', () => {
    it('should generate a personalized opening hook', async () => {
        const business = {
            name: "Artisan Brews Detroit",
            category: "brewery"
        };
        const deep_context = "Recently launched a new 'Artisanal Reserve' stout line and is actively seeking sustainability partners.";
        
        // Mocking the LLM
        const mockInvoke = vi.fn().mockResolvedValue({
            content: "Saw you recently launched your new 'Artisanal Reserve' line - the commitment to transparency in that process is exactly the kind of brand story we love to amplify."
        });
        vi.spyOn(llmModule, 'get_llm').mockReturnValue({
            invoke: mockInvoke
        } as any);
        
        const hook = await generate_opening_hook(business, deep_context, 'brewery');
        
        expect(hook).toContain("Artisanal Reserve");
        expect(hook.split(' ').length).toBeGreaterThan(10);
        expect(mockInvoke).toHaveBeenCalled();
    });
});
