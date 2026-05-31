import React from 'react';
import { createPortal } from 'react-dom';
import styles from './TableToolbar.module.css';

interface TableRenamePopupProps {
  popupRef: React.RefObject<HTMLDivElement | null>;
  position: { top: number; left: number };
  inputRef: React.RefObject<HTMLInputElement | null>;
  renameTableName: string;
  setRenameTableName: React.Dispatch<React.SetStateAction<string>>;
  renameRecordName: string;
  showDuplicateTooltip: boolean;
  handleSaveRename: () => void;
  handleCancelRename: () => void;
}

export function TableRenamePopup({
  popupRef,
  position,
  inputRef,
  renameTableName,
  setRenameTableName,
  renameRecordName,
  showDuplicateTooltip,
  handleSaveRename,
  handleCancelRename,
}: TableRenamePopupProps) {
  return createPortal(
    <div
      ref={popupRef}
      className={styles.tableRenamePopup}
      style={{ top: position.top, left: position.left }}
    >
      <div className={styles.tableRenameInputWrapper}>
        <input
          ref={inputRef}
          type="text"
          className={styles.tableRenameInput}
          value={renameTableName}
          onChange={(e) => setRenameTableName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveRename();
            else if (e.key === 'Escape') handleCancelRename();
          }}
        />
        {showDuplicateTooltip && (
          <div className={styles.tableRenameTooltip}>
            <div className={styles.tableRenameTooltipContent}>
              Please enter a unique table name
            </div>
          </div>
        )}
      </div>

      <div className={styles.tableRenameRecordLabelRow}>
        <span className={styles.tableRenameRecordLabelText}>What should each record be called?</span>
        <svg className={styles.tableRenameQuestionIcon} viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="nonzero" d="M8.07349 4.50134C7.75062 4.49155 7.43049 4.55078 7.13904 4.67151C6.36183 4.99344 5.75017 5.76895 5.75 6.74988C5.74997 6.88249 5.80262 7.00968 5.89636 7.10347C5.99011 7.19726 6.11727 7.24997 6.24988 7.25C6.31554 7.25002 6.38056 7.2371 6.44123 7.21199C6.5019 7.18687 6.55703 7.15006 6.60347 7.10364C6.64991 7.05722 6.68675 7.00211 6.71189 6.94145C6.73704 6.8808 6.74998 6.81578 6.75 6.75012C6.75013 6.17215 7.08092 5.77793 7.52173 5.59534C7.96254 5.41275 8.47515 5.45759 8.88391 5.86621C9.24251 6.22468 9.34907 6.75995 9.15503 7.22839C8.96099 7.69684 8.50716 8.00009 8.00012 8C7.93445 7.99999 7.86942 8.01292 7.80875 8.03804C7.74808 8.06316 7.69295 8.09999 7.6465 8.14642C7.60006 8.19285 7.56322 8.24797 7.53809 8.30864C7.51295 8.36931 7.50001 8.43433 7.5 8.5V9C7.5 9.13261 7.55268 9.25979 7.64645 9.35355C7.74021 9.44732 7.86739 9.5 8 9.5C8.13261 9.5 8.25979 9.44732 8.35355 9.35355C8.44732 9.25979 8.5 9.13261 8.5 9V8.93738C9.1999 8.77686 9.79665 8.2924 10.0789 7.61108C10.4266 6.77156 10.2336 5.80137 9.59094 5.15894C9.15735 4.7255 8.61159 4.51766 8.07349 4.50134Z M8 12C8.41419 12 8.75 11.6642 8.75 11.25C8.75 10.8358 8.41419 10.5 8 10.5C7.58581 10.5 7.25 10.8358 7.25 11.25C7.25 11.6642 7.58581 12 8 12Z M8 1.5C4.41604 1.5 1.5 4.41604 1.5 8C1.5 11.5839 4.41603 14.5 8 14.5C11.5839 14.5 14.5 11.5839 14.5 8C14.5 4.41603 11.5839 1.5 8 1.5ZM8 2.5C11.0435 2.5 13.5 4.95647 13.5 8C13.5 11.0435 11.0435 13.5 8 13.5C4.95647 13.5 2.5 11.0435 2.5 8C2.5 4.95647 4.95647 2.5 8 2.5Z" />
        </svg>
      </div>

      <div className={styles.tableRenameRecordSelector}>
        <span className={styles.tableRenameRecordText}>{renameRecordName}</span>
        <svg className={styles.tableRenameChevronIcon} viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="nonzero" d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z" />
        </svg>
      </div>

      <div className={styles.tableRenameExampleRow}>
        <span className={styles.tableRenameExampleLabel}>Examples:</span>
        <div className={styles.tableRenameExampleItems}>
          <div className={styles.tableRenameExampleItem}>
            <svg className={styles.tableRenameExampleIcon} viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="nonzero" d="M8 2C7.86739 2 7.74021 2.05268 7.64645 2.14645C7.55268 2.24021 7.5 2.36739 7.5 2.5V7.5H2.5C2.36739 7.5 2.24021 7.55268 2.14645 7.64645C2.05268 7.74021 2 7.86739 2 8C2 8.13261 2.05268 8.25979 2.14645 8.35355C2.24021 8.44732 2.36739 8.5 2.5 8.5H7.5V13.5C7.5 13.6326 7.55268 13.7598 7.64645 13.8536C7.74021 13.9473 7.86739 14 8 14C8.13261 14 8.25979 13.9473 8.35355 13.8536C8.44732 13.7598 8.5 13.6326 8.5 13.5V8.5H13.5C13.6326 8.5 13.7598 8.44732 13.8536 8.35355C13.9473 8.25979 14 8.13261 14 8C14 7.86739 13.9473 7.74021 13.8536 7.64645C13.7598 7.55268 13.6326 7.5 13.5 7.5H8.5V2.5C8.5 2.36739 8.44732 2.24021 8.35355 2.14645C8.25979 2.05268 8.13261 2 8 2Z" />
            </svg>
            Add {renameRecordName.toLowerCase()}
          </div>
          <div className={styles.tableRenameExampleItem}>
            <svg className={styles.tableRenameExampleIcon} viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="nonzero" d="M2.5 4H13.5V12H2.50012L2.5 4Z M2 3C1.8674 3.00001 1.74023 3.0527 1.64646 3.14646C1.5527 3.24023 1.50001 3.3674 1.5 3.5V12C1.50007 12.5463 1.95357 12.9999 2.49988 13C2.49984 13 2.49992 13 2.49988 13H13.5C14.0464 13 14.5 12.5464 14.5 12V3.5C14.5 3.3674 14.4473 3.24023 14.3535 3.14646C14.2598 3.0527 14.1326 3.00001 14 3H2ZM1.97827 3.00049C1.84581 3.00625 1.72107 3.06439 1.63147 3.16211C1.54186 3.25985 1.49475 3.38919 1.50049 3.52167C1.50624 3.65414 1.56437 3.77891 1.66211 3.86853L7.66211 9.36853C7.75433 9.45307 7.87489 9.49996 8 9.49996C8.12511 9.49996 8.24567 9.45307 8.33789 9.36853L14.3379 3.86853C14.4356 3.77891 14.4938 3.65414 14.4995 3.52167C14.5053 3.38919 14.4581 3.25985 14.3685 3.16211C14.2789 3.06437 14.1541 3.00624 14.0217 3.00049C13.8892 2.99475 13.7599 3.04186 13.6621 3.13147L8 8.32166L2.33789 3.13147C2.28949 3.08709 2.23281 3.05268 2.17111 3.03021C2.10941 3.00773 2.04388 2.99764 1.97827 3.00049Z" />
            </svg>
            Send {renameRecordName.toLowerCase()}s
          </div>
        </div>
      </div>

      <div className={styles.tableRenameButtonsRow}>
        <button
          type="button"
          className={styles.tableRenameCancelButton}
          onClick={handleCancelRename}
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.tableRenameSaveButton}
          onClick={handleSaveRename}
        >
          Save
        </button>
      </div>
    </div>,
    document.body
  );
}
