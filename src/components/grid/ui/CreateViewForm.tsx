import React from 'react';
import { createPortal } from 'react-dom';
import styles from './ViewsSidebar.module.css';

const UpsellStarIcon = () => (
  <svg className={styles.createViewBoxUpsellStar} viewBox="0 0 16 16" fill="rgb(22, 110, 225)" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
    <path fillRule="nonzero" d="M9.84928 11.9396C9.96786 12.0088 10.106 12.0487 10.2443 12.0496C10.4026 12.0486 10.5606 11.9986 10.6893 11.8996C10.9293 11.7196 11.0393 11.3996 10.9693 11.1096L10.4293 8.98961L12.0993 7.59961C12.3393 7.40961 12.4293 7.07961 12.3393 6.78961C12.2393 6.48961 11.9793 6.27961 11.6693 6.25961L9.49928 6.11961L8.68928 4.07961C8.58928 3.78961 8.29928 3.59961 7.99928 3.59961C7.69928 3.59961 7.41928 3.78961 7.30928 4.07961L6.49928 6.11961L4.32928 6.25961C4.01928 6.27961 3.74928 6.48961 3.65928 6.78961C3.56928 7.07961 3.66928 7.40961 3.89928 7.59961L5.55928 8.98961L5.05928 10.9496C4.97928 11.2696 5.09928 11.6096 5.35928 11.8096C5.62928 12.0096 5.99928 12.0296 6.27928 11.8496L7.99928 10.7596L9.84928 11.9396ZM8.40928 9.98961C8.28928 9.91961 8.14928 9.87961 8.00928 9.87961V9.88961C7.86928 9.88961 7.72928 9.91961 7.60928 9.99961L5.92928 11.0596L6.41928 9.13961C6.48928 8.85961 6.38928 8.54961 6.16928 8.36961L4.64928 7.09961L6.62928 6.96961C6.91928 6.94961 7.17928 6.75961 7.27928 6.48961L8.00928 4.64961L8.73928 6.48961C8.83928 6.76961 9.09928 6.94961 9.38928 6.96961L11.3693 7.09961L9.84928 8.36961C9.61928 8.54961 9.51928 8.84961 9.58928 9.10961L10.0893 11.0596L8.40928 9.98961Z M7.99999 1C4.134 1 0.999992 4.13401 0.999992 8C0.999992 11.866 4.134 15 7.99999 15C11.866 15 15 11.866 15 8C15 4.13401 11.866 1 7.99999 1ZM1.99999 8C1.99999 4.68629 4.68628 2 7.99999 2C11.3137 2 14 4.68629 14 8C14 11.3137 11.3137 14 7.99999 14C4.68628 14 1.99999 11.3137 1.99999 8Z" />
  </svg>
);

interface CreateViewFormProps {
  formRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  style: React.CSSProperties;
  viewName: string;
  onViewNameChange: (name: string) => void;
  existingViewNames: string[];
  isPending: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

export function CreateViewForm({
  formRef,
  inputRef,
  style,
  viewName,
  onViewNameChange,
  existingViewNames,
  isPending,
  onCancel,
  onSubmit,
}: CreateViewFormProps) {
  const isDuplicate = existingViewNames.includes(viewName.trim()) && viewName.trim() !== '';

  return createPortal(
    <div ref={formRef} className={styles.createViewBoxContainer} style={style}>
      <div className={styles.createViewBoxInputSection}>
        <input
          ref={inputRef}
          type="text"
          className={styles.createViewBoxInput}
          value={viewName}
          onChange={(e) => onViewNameChange(e.target.value)}
        />
        {isDuplicate && (
          <div className={styles.createViewDuplicateWarning}>
            Please enter a unique view name
          </div>
        )}
      </div>

      <div className={styles.createViewBoxWhoCanEditLabel}>Who can edit</div>

      <ul className={styles.createViewBoxOptionsContainer}>
        <li className={styles.createViewBoxOption} style={{ marginRight: 16 }}>
          <div className={styles.createViewBoxRadioCircleSelected}>
            <div className={styles.createViewBoxRadioDot} />
          </div>
          <svg className={styles.createViewBoxOptionIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
            <path fillRule="nonzero" d="M8 5.75001C6.34908 5.75001 5 7.0991 5 8.75001C5 9.72266 5.47549 10.5819 6.19788 11.1309C5.23485 11.5518 4.42849 12.3022 3.95068 13.2808C3.92187 13.3398 3.90497 13.4039 3.90093 13.4694C3.8969 13.535 3.90582 13.6007 3.92717 13.6628C3.94853 13.7249 3.98191 13.7821 4.0254 13.8313C4.0689 13.8805 4.12165 13.9207 4.18067 13.9495C4.29982 14.0076 4.4372 14.0161 4.56258 13.9729C4.68796 13.9298 4.79107 13.8386 4.84924 13.7195C5.43767 12.5144 6.65894 11.7517 8 11.7517C9.34106 11.7517 10.5623 12.5144 11.1508 13.7195C11.2089 13.8386 11.312 13.9298 11.4374 13.9729C11.5628 14.0161 11.7002 14.0076 11.8193 13.9495C11.8783 13.9207 11.9311 13.8805 11.9746 13.8313C12.0181 13.7821 12.0515 13.7249 12.0728 13.6628C12.0942 13.6007 12.1031 13.535 12.0991 13.4694C12.095 13.4039 12.0781 13.3398 12.0493 13.2808C11.5715 12.3022 10.7652 11.5518 9.80212 11.1309C10.5245 10.5819 11 9.72266 11 8.75001C11 7.0991 9.65092 5.75001 8 5.75001ZM8 6.75001C9.11046 6.75001 10 7.63956 10 8.75001C10 9.86047 9.11046 10.75 8 10.75C6.88955 10.75 6 9.86047 6 8.75001C6 7.63956 6.88955 6.75001 8 6.75001Z" />
          </svg>
          <span className={styles.createViewBoxOptionText} style={{ marginRight: 4 }}>Collaborative</span>
        </li>

        <li className={styles.createViewBoxOption} style={{ marginRight: 16 }}>
          <div className={styles.createViewBoxRadioCircle} />
          <svg className={styles.createViewBoxOptionIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
            <path fillRule="nonzero" d="M8 9.49951C5.32109 9.49957 2.84382 10.93 1.50451 13.2501C1.43822 13.365 1.42025 13.5014 1.45457 13.6295C1.48888 13.7576 1.57267 13.8668 1.6875 13.9331C1.80235 13.9994 1.93883 14.0173 2.06691 13.983C2.195 13.9487 2.30419 13.8648 2.37048 13.75C3.53197 11.738 5.67677 10.4996 8 10.4995C10.3232 10.4995 12.4681 11.7379 13.6295 13.75C13.6958 13.8648 13.805 13.9487 13.9331 13.983C14.0612 14.0173 14.1976 13.9994 14.3125 13.9331C14.4273 13.8668 14.5111 13.7576 14.5454 13.6295C14.5797 13.5014 14.5618 13.365 14.4955 13.2501C13.1563 10.9299 10.679 9.49944 8 9.49951Z M8 1.5C5.52065 1.5 3.5 3.52065 3.5 6C3.5 8.47935 5.52065 10.4995 8 10.4995C10.4793 10.4995 12.5 8.47935 12.5 6C12.5 3.52065 10.4793 1.5 8 1.5ZM8 2.5C9.9389 2.5 11.5 4.0611 11.5 6C11.5 7.9389 9.9389 9.49951 8 9.49951C6.0611 9.49951 4.5 7.9389 4.5 6C4.5 4.0611 6.0611 2.5 8 2.5Z" />
          </svg>
          <span className={styles.createViewBoxOptionText} style={{ marginRight: 4 }}>Personal</span>
          <UpsellStarIcon />
        </li>

        <li className={styles.createViewBoxOption} style={{ marginRight: 16 }}>
          <div className={styles.createViewBoxRadioCircle} />
          <svg className={styles.createViewBoxOptionIcon} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style={{ shapeRendering: 'geometricPrecision' }}>
            <path fillRule="nonzero" d="M8 10.25C8.41419 10.25 8.75 9.91419 8.75 9.5C8.75 9.08581 8.41419 8.75 8 8.75C7.58581 8.75 7.25 9.08581 7.25 9.5C7.25 9.91419 7.58581 10.25 8 10.25Z M8 0.5C6.48714 0.5 5.25 1.73714 5.25 3.25V5H3C2.45364 5 2 5.45364 2 6V13C2 13.5464 2.45364 14 3 14H13C13.5464 14 14 13.5464 14 13V6C14 5.45364 13.5464 5 13 5H10.75V3.25C10.75 1.73714 9.51286 0.5 8 0.5ZM8 1.5C8.97242 1.5 9.75 2.27758 9.75 3.25V5H6.25V3.25C6.25 2.27758 7.02758 1.5 8 1.5ZM3 6H13V13H3V6Z" />
          </svg>
          <span className={styles.createViewBoxOptionText} style={{ marginRight: 4 }}>Locked</span>
          <UpsellStarIcon />
        </li>
      </ul>

      <div className={styles.createViewBoxDescription}>All collaborators can edit the configuration</div>

      <div className={styles.createViewBoxButtonsContainer}>
        <button
          type="button"
          className={styles.createViewBoxCancelButton}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.createViewBoxCreateButton}
          disabled={isPending || !viewName.trim() || isDuplicate}
          onClick={onSubmit}
        >
          {isPending ? 'Creating...' : 'Create new view'}
        </button>
      </div>
    </div>,
    document.body
  );
}
