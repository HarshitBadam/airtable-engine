import styles from "./auth.module.css";

const PROMO_IMAGE_URL =
  "https://static.airtable.com/images/sign_in_page/omni_signin_large@2x.png";

export function PromoCard() {
  return (
    <div
      className={styles.promoCard}
      style={{ backgroundImage: `url('${PROMO_IMAGE_URL}')` }}
      role="img"
      aria-label="Meet Omni, your AI collaborator for building custom apps"
    />
  );
}
