/** Edition date shared by the consent text and the privacy policy; recorded with every lead. */
export const PERSONAL_DATA_CONSENT_VERSION = "2026-10-14";

type PersonalDataConsentProps = {
  formId: string;
  personalDataConsent: boolean;
  telegramConsent: boolean;
  disabled?: boolean;
  showValidation?: boolean;
  onPersonalDataConsentChange: (value: boolean) => void;
  onTelegramConsentChange: (value: boolean) => void;
  onConsentInvalid?: () => void;
};

/**
 * One checkbox covers both parts of the consent: processing of the request and its
 * delivery to the operator through Telegram. The text names both purposes; the form
 * still records the two parts, so every lead carries both marks.
 */
export function PersonalDataConsent({
  formId,
  personalDataConsent,
  telegramConsent,
  disabled = false,
  showValidation = false,
  onPersonalDataConsentChange,
  onTelegramConsentChange,
  onConsentInvalid,
}: PersonalDataConsentProps) {
  const consentId = `${formId}-consent`;
  const hintId = `${formId}-consent-hint`;
  const checked = personalDataConsent && telegramConsent;
  const hasConsentError = showValidation && !checked;
  const change = (value: boolean) => {
    onPersonalDataConsentChange(value);
    onTelegramConsentChange(value);
  };

  return (
    <fieldset className={hasConsentError ? "personal-data-consents consent-validation-error" : "personal-data-consents"} aria-describedby={hasConsentError ? hintId : undefined}>
      <legend>Согласие для отправки заявки</legend>
      <label className={hasConsentError ? "consent-check consent-check-invalid" : "consent-check"} htmlFor={consentId}>
        <input id={consentId} type="checkbox" checked={checked} onChange={(event) => change(event.target.checked)} onInvalid={(event) => { event.preventDefault(); onConsentInvalid?.(); }} disabled={disabled} required aria-invalid={hasConsentError} aria-describedby={hasConsentError ? hintId : undefined} />
        <span>Даю согласие ИП Бережному Егору Юрьевичу на обработку моих персональных данных — имени, телефона, email (если указал), параметров запроса и сведений в приложенном мной файле (если я его приложил) — для приёма, регистрации и ответа на заявку, в том числе на их передачу через мессенджер Telegram для оперативного уведомления оператора о моём обращении, а также на передачу приложенного файла сервису Claude (Anthropic, США) для автоматического расчёта сметы и отправку сметы мне в MAX или на email. С условиями, включая порядок и риски трансграничной передачи, ознакомлен(а) в <a href="/privacy-policy">Политике обработки персональных данных</a> и <a href="/personal-data-consent">тексте согласия</a>.</span>
      </label>
      {hasConsentError && <p className="consent-validation-tooltip" id={hintId} role="alert">Пожалуйста, подтвердите согласие, чтобы отправить заявку.</p>}
      <p>Согласие можно отозвать, позвонив по номеру <a href="tel:+79779480672">8 (977) 948‑06‑72</a>. Отзыв не влияет на законность обработки до его получения.</p>
    </fieldset>
  );
}
