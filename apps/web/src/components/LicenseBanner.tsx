import { CONTACT_URL } from '../lib/constants';

export function LicenseBanner() {
    return (
        <aside className="license-banner" role="note">
            <strong>Proprietary software.</strong> node-jhora is closed source; commercial use
            requires a paid license. <a href={CONTACT_URL}>Contact for licensing</a>.
        </aside>
    );
}
