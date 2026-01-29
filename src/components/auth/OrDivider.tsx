/**
 * OrDivider - "or" divider between auth methods
 * Matches Airtable's actual implementation: margin-based (my2-and-half class)
 * Note: Airtable does NOT have lines, just centered "or" text
 */

export function OrDivider() {
  return (
    <div
      className="flex w-[500px] items-center justify-center"
      style={{ fontFamily: "var(--at-font-body)", marginTop: 24, marginBottom: 24 }}
    >
      <span className="text-[16px] font-normal leading-[20px] text-[#616670]">
        or
      </span>
    </div>
  );
}
