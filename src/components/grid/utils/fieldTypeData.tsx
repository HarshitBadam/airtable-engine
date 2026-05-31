import React from "react";
import {
  AgentIconAnalyzeAttachment,
  AgentIconResearchCompanies,
  AgentIconFindImageFromWeb,
  AgentIconGenerateImage,
  AgentIconDeepMatch,
  AgentIconBuildPrototype,
  AgentIconBuildFieldAgent,
  AgentIconBrowseCatalog,
  FieldIconSingleLineText,
  FieldIconLongText,
  FieldIconAttachment,
  FieldIconCheckbox,
  FieldIconMultipleSelect,
  FieldIconSingleSelect,
  FieldIconUser,
  FieldIconDate,
  FieldIconPhoneNumber,
  FieldIconEmail,
  FieldIconUrl,
  FieldIconNumber,
  FieldIconCurrency,
  FieldIconPercent,
  FieldIconDuration,
  FieldIconRating,
  FieldIconFormula,
  FieldIconRollup,
  FieldIconCount,
  FieldIconLookup,
  FieldIconCreatedTime,
  FieldIconLastModifiedTime,
  FieldIconCreatedBy,
  FieldIconLastModifiedBy,
  FieldIconAutonumber,
  FieldIconBarcode,
  FieldIconButton,
  FieldIconLinkToRecord,
} from "~/components/grid/ui/CreateFieldPanelIcons";

export interface FieldAgentItem {
  label: string;
  color: string;
  icon: React.ReactNode;
}

export interface StandardFieldItem {
  label: string;
  icon: React.ReactNode;
  hasChevron?: boolean;
}

export const fieldAgentItems: FieldAgentItem[] = [
  { label: "Analyze attachment", color: "#068A0D", icon: <AgentIconAnalyzeAttachment /> },
  { label: "Research companies", color: "#156EE1", icon: <AgentIconResearchCompanies /> },
  { label: "Find image from web", color: "#7D37EF", icon: <AgentIconFindImageFromWeb /> },
  { label: "Generate image", color: "#C4460B", icon: <AgentIconGenerateImage /> },
  { label: "Deep Match", color: "#0E7490", icon: <AgentIconDeepMatch /> },
  { label: "Build prototype", color: "#7C3AED", icon: <AgentIconBuildPrototype /> },
  { label: "Build field agent", color: "#1D4ED8", icon: <AgentIconBuildFieldAgent /> },
  { label: "Browse catalog", color: "#0369A1", icon: <AgentIconBrowseCatalog /> },
];

export const standardFieldItems: StandardFieldItem[] = [
  { label: "Text", icon: <FieldIconSingleLineText /> },
  { label: "Long text", icon: <FieldIconLongText /> },
  { label: "Attachment", icon: <FieldIconAttachment /> },
  { label: "Checkbox", icon: <FieldIconCheckbox /> },
  { label: "Multiple select", icon: <FieldIconMultipleSelect /> },
  { label: "Single select", icon: <FieldIconSingleSelect /> },
  { label: "User", icon: <FieldIconUser /> },
  { label: "Date", icon: <FieldIconDate /> },
  { label: "Phone number", icon: <FieldIconPhoneNumber /> },
  { label: "Email", icon: <FieldIconEmail /> },
  { label: "URL", icon: <FieldIconUrl /> },
  { label: "Number", icon: <FieldIconNumber /> },
  { label: "Currency", icon: <FieldIconCurrency />, hasChevron: true },
  { label: "Percent", icon: <FieldIconPercent /> },
  { label: "Duration", icon: <FieldIconDuration /> },
  { label: "Rating", icon: <FieldIconRating /> },
  { label: "Formula", icon: <FieldIconFormula /> },
  { label: "Rollup", icon: <FieldIconRollup /> },
  { label: "Count", icon: <FieldIconCount /> },
  { label: "Lookup", icon: <FieldIconLookup /> },
  { label: "Link to another record", icon: <FieldIconLinkToRecord /> },
  { label: "Created time", icon: <FieldIconCreatedTime /> },
  { label: "Last modified time", icon: <FieldIconLastModifiedTime /> },
  { label: "Created by", icon: <FieldIconCreatedBy /> },
  { label: "Last modified by", icon: <FieldIconLastModifiedBy /> },
  { label: "Autonumber", icon: <FieldIconAutonumber /> },
  { label: "Barcode", icon: <FieldIconBarcode /> },
  { label: "Button", icon: <FieldIconButton /> },
];

export const enabledFieldTypes = new Set<string>(["Text", "Number"]);
