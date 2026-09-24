import React from 'react';
import { TeamMember, teamCardUrl } from '../../services/teamMemberService';
import { QrCodeDialog } from '../admin/QrCodeDialog';

interface TeamCardQrModalProps {
  member: TeamMember | null;
  onClose: () => void;
}

const TeamCardQrModal: React.FC<TeamCardQrModalProps> = ({ member, onClose }) => (
  <QrCodeDialog
    open={Boolean(member)}
    onClose={onClose}
    title={member?.name}
    description="Scan to open this contact card."
    url={member ? teamCardUrl(member.slug) : ''}
    alt={member ? `QR code linking to ${member.name}'s contact card` : ''}
    fileStem={member ? `${member.slug}-qr` : 'team-card-qr'}
    openLabel="Open card"
    warnings={
      member && !member.active
        ? [
            'This card is deactivated — the code resolves to a "not found" page until you reactivate it.',
          ]
        : []
    }
    pngUse="slides and badges"
  />
);

export default TeamCardQrModal;
