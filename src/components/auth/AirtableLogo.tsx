/**
 * AirtableLogo - Airtable logo component for auth pages
 */

import { AirtableLogoIcon } from "./Icons";

interface AirtableLogoProps {
  width?: number;
}

export function AirtableLogo({ width = 42 }: AirtableLogoProps) {
  return (
    <div>
      <AirtableLogoIcon width={width} />
    </div>
  );
}
