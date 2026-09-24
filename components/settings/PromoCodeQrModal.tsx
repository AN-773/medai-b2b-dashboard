import React from 'react';
import { PromoCode, getPromoStatus, promoRedeemUrl } from '../../services/promoCodeService';
import { QrCodeDialog } from '../admin/QrCodeDialog';

interface PromoCodeQrModalProps {
  promo: PromoCode | null;
  onClose: () => void;
}

/**
 * Why each dead state is worth blocking on before printing: a code that cannot
 * redeem produces a QR that fails silently in the scanner's hand, and reprinting
 * a flyer run is expensive.
 */
const DEAD_STATE_WARNINGS: Record<string, string> = {
  Inactive: 'This code is deactivated — scanning it will fail until you reactivate it.',
  Expired: 'This code has passed its expiry date — scanning it will fail.',
  Exhausted: 'This code has hit its redemption limit — scanning it will fail until you raise the cap.',
};

const PromoCodeQrModal: React.FC<PromoCodeQrModalProps> = ({ promo, onClose }) => {
  const redeemUrl = promo ? promoRedeemUrl(promo.code) : '';

  const warnings: React.ReactNode[] = [];
  let meta = '';
  if (promo) {
    const deadStateWarning = DEAD_STATE_WARNINGS[getPromoStatus(promo)];
    if (deadStateWarning) warnings.push(deadStateWarning);
    // A printed code is public and copyable forever, so an uncapped one is
    // worth flagging before it goes out the door.
    if (promo.maxRedemptions === 0) {
      warnings.push(
        'This code has no redemption limit. Anyone who photographs the printed code can share it — set a max redemption count before distributing it.',
      );
    }
    const remainingUses =
      promo.maxRedemptions > 0 ? promo.maxRedemptions - promo.redemptionCount : null;
    meta =
      remainingUses === null
        ? `${promo.redemptionCount} redeemed so far`
        : `${remainingUses} of ${promo.maxRedemptions} redemptions left`;
  }

  return (
    <QrCodeDialog
      open={Boolean(promo)}
      onClose={onClose}
      title={<span className="font-mono">{promo?.code}</span>}
      description={
        promo
          ? `Scan to redeem ${promo.freeDays} free day${promo.freeDays === 1 ? '' : 's'} of Pro.`
          : undefined
      }
      url={redeemUrl}
      alt={promo ? `QR code to redeem promo code ${promo.code}` : ''}
      fileStem={promo ? `${promo.code.toLowerCase()}-promo-qr` : 'promo-qr'}
      openLabel="Open redeem page"
      warnings={warnings}
      meta={meta}
      pngUse="slides and handouts"
    />
  );
};

export default PromoCodeQrModal;
