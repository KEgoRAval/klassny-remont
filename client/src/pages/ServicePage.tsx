import { useState } from "react";
import { ArrowRight, Check, MessageCircle, Paperclip, Phone, Send, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { reachLeadGoal } from "@/lib/metrika";
import { imageSize } from "@/content/media";
import { type ServicePage as ServiceContent } from "@/content/services";
import { PERSONAL_DATA_CONSENT_VERSION, PersonalDataConsent } from "@/components/PersonalDataConsent";
import { TELEGRAM_URL, WHATSAPP_URL } from "@/components/MessengerQuickActions";
import { Dot, FaqIcon, ICON_STROKE, SectionLabel, SiteFooter, SiteHeader } from "@/components/KremChrome";
import { DESIGN_FILE_ACCEPT, DESIGN_FILE_SERVER_MESSAGES, designFileProblem, formatFileSize, readFileAsBase64 } from "@/lib/designFile";
import { Breadcrumbs } from "./Blog";

function ServiceLeadForm({ page }: { page: ServiceContent }) {
  const { form } = page;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [reading, setReading] = useState(false);
  const [consent, setConsent] = useState(false);
  const [showConsentError, setShowConsentError] = useState(false);
  const [sentName, setSentName] = useState<string | null>(null);
  const formId = `service-${page.slug}`;

  const submit = trpc.leads.submit.useMutation({
    onSuccess: () => {
      reachLeadGoal("lead_contact");
      setSentName(name);
      setPhone("");
      setEmail("");
      setFile(null);
      setConsent(false);
      setShowConsentError(false);
    },
  });
  const sending = reading || submit.isPending;

  const chooseFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (!chosen) return;
    const problem = designFileProblem(chosen);
    setFileError(problem ?? "");
    setFile(problem ? null : chosen);
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!consent) {
      setShowConsentError(true);
      return;
    }
    if (form.file === "required" && !file) {
      setFileError("Приложите дизайн-проект в PDF или картинкой.");
      return;
    }
    let attachment: { fileName: string; data: string } | undefined;
    if (file) {
      setReading(true);
      try {
        attachment = { fileName: file.name, data: await readFileAsBase64(file) };
      } catch {
        setFileError("Не удалось прочитать файл. Выберите его ещё раз.");
        return;
      } finally {
        setReading(false);
      }
    }
    submit.mutate({
      name,
      phone,
      service: form.service,
      area: 70,
      materialLabel: "Не указан",
      workEstimate: 0,
      source: "contact",
      personalDataConsent: true,
      telegramConsent: true,
      consentVersion: PERSONAL_DATA_CONSENT_VERSION,
      policyVersion: PERSONAL_DATA_CONSENT_VERSION,
      attachment,
      email: file ? email : undefined,
    });
  };

  return (
    <section id="request" className="k-panel k-contacts">
      <div className="k-panel-inner k-contacts-grid">
        <div className="k-stack k-stack-lg">
          <SectionLabel tone="light">{page.shortTitle}</SectionLabel>
          <h2>{form.title}<Dot /></h2>
          <p className="k-contacts-text">{form.text}</p>
          <div className="k-contact-pills"><a href="tel:+79779480672"><Phone size={17} strokeWidth={ICON_STROKE} />8 (977) 948‑06‑72</a><a href={TELEGRAM_URL} target="_blank" rel="noreferrer"><Send size={17} strokeWidth={ICON_STROKE} />Telegram</a><a href={WHATSAPP_URL} target="_blank" rel="noreferrer"><MessageCircle size={17} strokeWidth={ICON_STROKE} />WhatsApp</a></div>
        </div>
        <div className="k-form-card">
          {sentName !== null ? (
            <div className="k-estimate-success" aria-live="polite">
              <span className="k-thankyou-check" aria-hidden="true"><Check size={30} strokeWidth={ICON_STROKE} /></span>
              <SectionLabel>Заявка отправлена</SectionLabel>
              <h3>Спасибо{sentName ? `, ${sentName}` : ""}.</h3>
              <p>{form.file === "none" ? "Перезвоним в рабочее время и обсудим задачу." : "Проект у нас. Смету подготовим в течение 2 часов в рабочее время и свяжемся с вами."}</p>
            </div>
          ) : (
            <form className="k-form" onSubmit={onSubmit}>
              <div className="field"><label htmlFor={`${formId}-name`}>Ваше имя</label><input className="ym-record-keys" id={`${formId}-name`} value={name} onChange={(e) => setName(e.target.value)} disabled={sending} required minLength={2} autoComplete="name" placeholder="Как к вам обращаться" /></div>
              <div className="field"><label htmlFor={`${formId}-phone`}>Телефон</label><input className="ym-record-keys" id={`${formId}-phone`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={sending} required minLength={6} autoComplete="tel" placeholder="+7 (___) ___-__-__" /></div>
              {form.file !== "none" && (
                <div className="k-file-field">
                  <label className={file ? "k-file k-file-chosen" : "k-file"} htmlFor={`${formId}-file`}>
                    <input id={`${formId}-file`} type="file" accept={DESIGN_FILE_ACCEPT} onChange={chooseFile} disabled={sending} aria-describedby={fileError ? `${formId}-file-error` : undefined} />
                    <span className="k-file-icon"><Paperclip size={16} strokeWidth={ICON_STROKE} /></span>
                    {file ? <span className="k-file-name">{file.name} <span className="k-muted">· {formatFileSize(file.size)}</span></span> : <span>Прикрепить дизайн-проект <span className="k-muted">· PDF{form.file === "optional" ? ", необязательно" : ""}</span></span>}
                  </label>
                  {file && <button type="button" className="k-file-remove" onClick={() => setFile(null)} disabled={sending} aria-label="Убрать файл"><X size={16} strokeWidth={ICON_STROKE} /></button>}
                  {fileError ? <p className="form-error" id={`${formId}-file-error`} role="alert">{fileError}</p> : <small className="k-file-hint">Файл увидит только команда «Классного ремонта». Не прикладывайте паспортные данные и другие документы, не нужные для расчёта.</small>}
                </div>
              )}
              {file && <div className="field"><label htmlFor={`${formId}-email`}>Email — пришлём смету по проекту</label><input className="ym-record-keys" id={`${formId}-email`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={sending} required autoComplete="email" placeholder="name@mail.ru" /></div>}
              <PersonalDataConsent formId={formId} personalDataConsent={consent} telegramConsent={consent} disabled={sending} showValidation={showConsentError} onConsentInvalid={() => setShowConsentError(true)} onPersonalDataConsentChange={setConsent} onTelegramConsentChange={setConsent} />
              <button type="submit" disabled={sending} className={sending ? "btn btn-primary k-btn-lg k-btn-block form-submit-loading" : "btn btn-primary k-btn-lg k-btn-block"}>{sending ? <><span className="button-loader" aria-hidden="true"><i></i><i></i><i></i></span>Отправляем</> : <>{form.button}<ArrowRight size={18} strokeWidth={ICON_STROKE} /></>}</button>
              {submit.isError && <p className="form-error" role="alert">{DESIGN_FILE_SERVER_MESSAGES.includes(submit.error.message) ? submit.error.message : "Не удалось отправить заявку. Позвоните нам или повторите попытку."}</p>}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

export function ServicePageView({ page }: { page: ServiceContent }) {
  return (
    <div className="krem-site k-blog k-article-page k-service-page" id="top">
      <SiteHeader page="service" />
      <main>
        <header className="k-container k-article-hero">
          <div className="k-article-head">
            <Breadcrumbs items={[{ href: "/", label: "Главная" }, { label: page.shortTitle }]} />
            <SectionLabel>{page.eyebrow}</SectionLabel>
            <h1>{page.h1} <span className="k-accent">{page.h1Accent}</span><Dot /></h1>
            <p className="k-body-lg">{page.lead}</p>
            <div className="k-actions"><a className="btn btn-primary k-btn-lg" href="#request">{page.form.button}<ArrowRight size={18} strokeWidth={ICON_STROKE} /></a><a className="btn btn-secondary k-btn-lg" href="tel:+79779480672">8 (977) 948‑06‑72</a></div>
          </div>
          <div className="k-article-cover washed"><img src={page.image} {...imageSize(page.image)} alt={page.imageAlt} fetchPriority="high" decoding="async" /></div>
        </header>

        <section className="k-container k-service-highlights" aria-label="Коротко">
          {page.highlights.map(item => <div key={item.label}><b>{item.value}</b><span>{item.label}</span></div>)}
        </section>

        <div className="k-container k-article-layout">
          <aside className="k-article-toc"><p>На странице</p><ol>{page.sections.map((section, index) => <li key={section.heading}><a href={`#section-${index + 1}`}>{section.heading}</a></li>)}</ol><a href="#request" className="btn btn-primary k-btn-sm">{page.form.button} <ArrowRight size={15} strokeWidth={ICON_STROKE} /></a></aside>
          <div className="k-article-content">
            <div className="k-article-answer"><SectionLabel tone="sage">Коротко</SectionLabel><p>{page.directAnswer}</p></div>
            {page.sections.map((section, index) => (
              <section className="k-article-section" id={`section-${index + 1}`} key={section.heading}>
                <h2>{section.heading}</h2>
                {section.paragraphs?.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                {section.bullets && <ul>{section.bullets.map(bullet => <li key={bullet}>{bullet}</li>)}</ul>}
              </section>
            ))}
            <section className="k-article-faq" aria-labelledby="service-faq-title"><SectionLabel>Частые вопросы</SectionLabel><h2 id="service-faq-title">Что спрашивают чаще всего<Dot /></h2><div className="k-faq-list">{page.faqs.map((faq, index) => <details name="service-faq" open={index === 0} key={faq.question}><summary>{faq.question}<FaqIcon /></summary><p>{faq.answer}</p></details>)}</div></section>
            <nav className="k-service-related" aria-label="Смотрите также"><span>Смотрите также:</span>{page.related.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}</nav>
          </div>
        </div>

        <section className="k-panel k-process k-service-steps">
          <div className="k-panel-inner">
            <SectionLabel>Процесс</SectionLabel>
            <h2>{page.stepsTitle}<Dot /></h2>
            <div className="k-steps">{page.steps.map((step, index) => <article className="k-step" key={step.title}><span className="k-step-num">{String(index + 1).padStart(2, "0")}</span><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
          </div>
        </section>

        <ServiceLeadForm page={page} />
      </main>
      <SiteFooter page="service" />
    </div>
  );
}
