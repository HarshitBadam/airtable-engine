/**
 * CreateBaseDialog component
 * Dialog for creating a new base
 */

export interface CreateBaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => Promise<void>;
}

export function CreateBaseDialog({
  open,
  onOpenChange,
  onCreate,
}: CreateBaseDialogProps) {
  // Suppress unused variable warnings in stub
  void open;
  void onOpenChange;
  void onCreate;

  return <div>CreateBaseDialog</div>;
}
