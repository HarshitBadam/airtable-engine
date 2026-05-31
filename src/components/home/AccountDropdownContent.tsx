import React from "react";
import {
  UserIcon,
  UsersIcon,
  AirtablePlusFillIcon,
  BellIcon,
  TranslateIcon,
  PaletteIcon,
  EnvelopeSimpleIcon,
  UpsellStarIcon,
  LinkIcon,
  WrenchIcon,
  TrashIcon,
  SignOutIcon,
  ChevronDownIcon,
} from "~/components/home/Icons";

export interface AccountDropdownStyles {
  header: string;
  headerName: string;
  headerEmail: string;
  item: string;
  itemIcon: string;
  itemText: string;
  itemArrow: string;
  badgeBusiness: string;
  badgeBusinessIcon: string;
  badgeBeta: string;
  divider: string;
  dividerAfterAppearance: string;
}

interface AccountDropdownContentProps {
  userName: string;
  userEmail: string;
  onLogout: () => void;
  classNames: AccountDropdownStyles;
}

export function AccountDropdownContent({
  userName,
  userEmail,
  onLogout,
  classNames: s,
}: AccountDropdownContentProps) {
  return (
    <>
      <div className={s.header}>
        <div>
          <p className={s.headerName}>{userName}</p>
          <span className={s.headerEmail}>{userEmail}</span>
        </div>
      </div>

      <button type="button" className={s.item}>
        <span className={s.itemIcon}><UserIcon size={16} /></span>
        <span className={s.itemText}>Account</span>
      </button>

      <button type="button" className={s.item}>
        <span className={s.itemIcon}><UsersIcon size={16} /></span>
        <span className={s.itemText}>Manage groups</span>
        <span className={s.badgeBusiness}>
          <span className={s.badgeBusinessIcon}>
            <AirtablePlusFillIcon size={12} color="rgb(15, 104, 162)" />
          </span>
          Business
        </span>
      </button>

      <button type="button" className={s.item}>
        <span className={s.itemIcon}><BellIcon size={16} /></span>
        <span className={s.itemText}>Notification preferences</span>
        <span className={s.itemArrow}><ChevronDownIcon size={16} /></span>
      </button>

      <button type="button" className={s.item}>
        <span className={s.itemIcon}><TranslateIcon size={16} /></span>
        <span className={s.itemText}>Language preferences</span>
        <span className={s.itemArrow}><ChevronDownIcon size={16} /></span>
      </button>

      <button type="button" className={s.item}>
        <span className={s.itemIcon}><PaletteIcon size={16} /></span>
        <span className={s.itemText}>Appearance</span>
        <span className={s.badgeBeta}>Beta</span>
        <span className={s.itemArrow}><ChevronDownIcon size={16} /></span>
      </button>

      <div className={s.dividerAfterAppearance} />

      <button type="button" className={s.item}>
        <span className={s.itemIcon}><EnvelopeSimpleIcon size={16} /></span>
        <span className={s.itemText}>Contact sales</span>
      </button>

      <button type="button" className={s.item}>
        <span className={s.itemIcon}><UpsellStarIcon size={16} /></span>
        <span className={s.itemText}>Upgrade</span>
      </button>

      <button type="button" className={s.item}>
        <span className={s.itemIcon}><EnvelopeSimpleIcon size={16} /></span>
        <span className={s.itemText}>Tell a friend</span>
      </button>

      <div className={s.divider} />

      <button type="button" className={s.item}>
        <span className={s.itemIcon}><LinkIcon size={16} /></span>
        <span className={s.itemText}>Integrations</span>
      </button>

      <button type="button" className={s.item}>
        <span className={s.itemIcon}><WrenchIcon size={16} /></span>
        <span className={s.itemText}>Builder hub</span>
      </button>

      <div className={s.divider} />

      <button type="button" className={s.item}>
        <span className={s.itemIcon}><TrashIcon size={16} /></span>
        <span className={s.itemText}>Trash</span>
      </button>

      <button type="button" className={s.item} onClick={onLogout}>
        <span className={s.itemIcon}><SignOutIcon size={16} /></span>
        <span className={s.itemText}>Log out</span>
      </button>
    </>
  );
}
