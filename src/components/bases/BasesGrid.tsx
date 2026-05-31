import styles from "./bases.module.css";
import { BaseCard } from "./BaseCard";

export interface BasesGridProps {
  bases: Array<{
    id: string;
    name: string;
    lastOpenedAt: Date;
    isStarred: boolean;
  }>;
}

export function BasesGrid({ bases }: BasesGridProps) {
  if (bases.length === 0) {
    return null;
  }

  return (
    <div className={styles.basesGridWrapper}>
      <div className={styles.basesGrid}>
        {bases.map((base) => (
          <BaseCard key={base.id} base={base} />
        ))}
      </div>
    </div>
  );
}
