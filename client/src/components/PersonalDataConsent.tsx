export const PERSONAL_DATA_CONSENT_VERSION = "2026-09-17";

type PersonalDataConsentProps = {
  formId: string;
  personalDataConsent: boolean;
  telegramConsent: boolean;
  disabled?: boolean;
  onPersonalDataConsentChange: (value: boolean) => void;
  onTelegramConsentChange: (value: boolean) => void;
};

/**
 * These checkboxes are deliberately separate: the first confirms the purpose-limited
 * processing of a request, and the second discloses delivery through Telegram.
 */
export function PersonalDataConsent({
  formId,
  personalDataConsent,
  telegramConsent,
  disabled = false,
  onPersonalDataConsentChange,
  onTelegramConsentChange,
}: PersonalDataConsentProps) {
  const personalDataId = `${formId}-personal-data-consent`;
  const telegramId = `${formId}-telegram-consent`;

  return (
    <fieldset className="personal-data-consents">
      <legend>Согласия для отправки заявки</legend>
      <label className="consent-check" htmlFor={personalDataId}>
        <input id={personalDataId} type="checkbox" checked={personalDataConsent} onChange={(event) => onPersonalDataConsentChange(event.target.checked)} disabled={disabled} required />
        <span>Даю согласие ИП Бережному Егору Юрьевичу на обработку моих персональных данных — имени, телефона и параметров запроса — для приёма, регистрации и ответа на заявку. С условиями ознакомлен(а) в <a href="/privacy-policy">Политике обработки персональных данных</a> и <a href="/personal-data-consent">тексте согласия</a>.</span>
      </label>
      <label className="consent-check" htmlFor={telegramId}>
        <input id={telegramId} type="checkbox" checked={telegramConsent} onChange={(event) => onTelegramConsentChange(event.target.checked)} disabled={disabled} required />
        <span>Даю согласие на передачу указанных в заявке данных через мессенджер Telegram для оперативного уведомления оператора о моём обращении. Порядок передачи и возможные риски описаны в <a href="/privacy-policy#telegram">Политике обработки персональных данных</a>.</span>
      </label>
      <p>Согласие можно отозвать, позвонив по номеру <a href="tel:+79779480672">8 (977) 948‑06‑72</a>. Отзыв не влияет на законность обработки до его получения.</p>
    </fieldset>
  );
}
