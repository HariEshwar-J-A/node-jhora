import { useI18n } from '../i18n';
import { CONTACT_URL } from '../lib/constants';

export function LicenseBanner() {
    const { t, rich } = useI18n();
    return (
        <aside className="license-banner" role="note">
            {rich('license.banner', {
                strong: <strong>{t('license.strong')}</strong>,
                link: <a href={CONTACT_URL}>{t('landing.contactLicensing')}</a>,
            })}
        </aside>
    );
}
