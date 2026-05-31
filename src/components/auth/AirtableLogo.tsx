import { AirtableLogoIcon } from "./AuthIcons";

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
