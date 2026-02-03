/**
 * BasesGrid component
 * Displays a responsive grid of base cards
 */

import styles from "./bases.module.css";
import { BaseCard } from "./BaseCard";

export interface BasesGridProps {
  bases: Array<{
    id: string;
    name: string;
    updatedAt: Date;
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
        {bases.map((base, index) => (
          <BaseCard 
            key={base.id} 
            base={base} 
            isLast={index === bases.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
