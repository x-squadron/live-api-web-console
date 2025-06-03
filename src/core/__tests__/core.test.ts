import { describe, it, expect } from "vitest";

// Test importing from @core alias to verify path resolution works
describe("@core import test", () => {
  it("should be able to import from @core alias", async () => {
    // This will test if the @core path alias works correctly
    const coreModule = await import("@core");

    // Basic test to ensure the module loads without error
    expect(coreModule).toBeDefined();
    expect(typeof coreModule).toBe("object");
  });
});
