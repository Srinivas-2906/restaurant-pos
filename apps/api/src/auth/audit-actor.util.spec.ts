import { operationalAuditMetadata } from "./audit-actor.util";

describe("operationalAuditMetadata", () => {
  it("includes operational actor fields", () => {
    const meta = operationalAuditMetadata(
      {
        authMode: "operational",
        staffProfileId: "staff-1",
        terminalId: "term-1",
        role: "captain",
      },
      { kotNumber: "KOT-0001" },
    );

    expect(meta).toEqual(
      expect.objectContaining({
        authMode: "operational",
        staffProfileId: "staff-1",
        terminalId: "term-1",
        role: "captain",
        kotNumber: "KOT-0001",
      }),
    );
  });
});
