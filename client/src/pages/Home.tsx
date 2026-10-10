import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Menu,
  MessageCircle,
  Minus,
  Paperclip,
  Phone,
  Plus,
  Send,
  Star,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PERSONAL_DATA_CONSENT_VERSION, PersonalDataConsent } from "@/components/PersonalDataConsent";
import { TELEGRAM_URL, WHATSAPP_URL } from "@/components/MessengerQuickActions";
import { imageSize, siteImages } from "@/content/media";
import { reachLeadGoal } from "@/lib/metrika";
import { DESIGN_FILE_ACCEPT, DESIGN_FILE_REJECTED_MESSAGE, designFileProblem, formatFileSize, readFileAsBase64 } from "@/lib/designFile";

const images = {
  hero: siteImages.hero.src,
  veryLiving: siteImages.veryLiving.src,
  veryEntry: siteImages.veryEntry.src,
  veryBedroom: siteImages.veryBedroom.src,
  veryBathroom: siteImages.veryBathroom.src,
  everLiving: siteImages.everLiving.src,
  everEntry: siteImages.everEntry.src,
  everBedroom: siteImages.everBedroom.src,
  everShower: siteImages.everShower.src,
};

const projectCards = [
  { image: images.veryLiving, title: "ЖК Very", meta: "Кухня-гостиная" },
  { image: images.everLiving, title: "ЖК Ever", meta: "Кухня-гостиная" },
  { image: images.veryBedroom, title: "ЖК Остров", meta: "Спальня" },
  { image: images.everEntry, title: "ЖК Level", meta: "Прихожая" },
];

const steps = [
  ["01", "Встреча и замер", "Выезжаем на объект, фиксируем задачу, бюджет и технические ограничения."],
  ["02", "Смета и договор", "Детализируем объём работ и календарный план. Смета фиксируется в договоре."],
  ["03", "Проектирование", "Синхронизируем дизайн, инженерные решения и спецификации до старта работ."],
  ["04", "Реализация", "Ведём объект по этапам: фотоотчёты, технадзор, контроль скрытых работ."],
  ["05", "Приёмка и гарантия", "Сдаём объект по чек‑листу и остаёмся на связи после переезда."],
];

const navLinks = [
  ["#projects", "Проекты"],
  ["#process", "Процесс"],
  ["#prices", "Цены"],
  ["/blog", "Блог"],
  ["#about", "О компании"],
  ["#contacts", "Контакты"],
];

/**
 * The design-project attachment is delivered to Telegram with the lead. Turn it on together with the
 * consent edition that names attached files (see PersonalDataConsent and the privacy policy).
 */
const DESIGN_FILE_UPLOAD_ENABLED = false;

const ICON_STROKE = 2.75;

function SectionLabel({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "sage" | "light" }) {
  return <div className={`k-label k-label-${tone}`}><span></span>{children}</div>;
}

/** The green full stop from the 1a logo, closing headings. */
function Dot({ tone = "sage" }: { tone?: "sage" | "accent" }) {
  return <span className={`k-dot k-dot-${tone}`} aria-hidden="true"></span>;
}

/** Wordmark 1a — «Krem • moscow» with the «Классный ремонт» caption, see design_handoff_krem_site/logo/krem-logo.svg. */
function KremLogo({ size = "header" }: { size?: "header" | "footer" }) {
  return (
    <span className={`k-logo k-logo-${size}`}>
      <span className="k-logo-mark"><span className="k-logo-krem">Krem</span><span className="k-logo-dot"></span><span className="k-logo-city">moscow</span></span>
      <span className="k-logo-caption">Классный ремонт</span>
    </span>
  );
}

type CalculatorDetails = {
  area: number;
  materialLabel: string;
  workEstimate: number;
  materialsEstimate: number;
  totalEstimate: number;
};

function SendingContent({ label }: { label: string }) {
  return <><span className="button-loader" aria-hidden="true"><i></i><i></i><i></i></span><span>{label}</span></>;
}

function ThankYouModal({ name, onClose }: { name: string | null; onClose: () => void }) {
  if (!name) return null;

  return (
    <div className="k-backdrop" role="dialog" aria-modal="true" aria-labelledby="thankyou-title" onMouseDown={onClose}>
      <div className="k-modal k-thankyou" onMouseDown={(event) => event.stopPropagation()}>
        <button className="k-modal-close" onClick={onClose} aria-label="Закрыть окно благодарности"><X size={20} strokeWidth={ICON_STROKE} /></button>
        <span className="k-thankyou-check" aria-hidden="true"><Check size={30} strokeWidth={ICON_STROKE} /></span>
        <SectionLabel>Заявка уже у команды</SectionLabel>
        <h2 id="thankyou-title">Спасибо, {name}.</h2>
        <p>Получили контакты и параметры расчёта. Свяжемся с вами в рабочее время, уточним детали и предложим удобное время для замера.</p>
        <div className="k-thankyou-details"><span>01</span><span>Ответ по заявке</span><b>в течение 2 часов</b></div>
        <button className="btn btn-secondary k-btn-md" onClick={onClose}>Вернуться на сайт</button>
      </div>
    </div>
  );
}

function LeadModal({ open, onClose, onSuccess, calculator }: { open: boolean; onClose: () => void; onSuccess: (name: string) => void; calculator: CalculatorDetails }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [personalDataConsent, setPersonalDataConsent] = useState(false);
  const [telegramConsent, setTelegramConsent] = useState(false);
  const [showConsentValidation, setShowConsentValidation] = useState(false);
  const submitLead = trpc.leads.submit.useMutation({
    onSuccess: () => {
      reachLeadGoal("lead_calculator");
      onSuccess(name);
      setName("");
      setPhone("");
      setPersonalDataConsent(false);
      setTelegramConsent(false);
      setShowConsentValidation(false);
    },
  });
  useEffect(() => {
    if (!open) setShowConsentValidation(false);
  }, [open]);
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!personalDataConsent || !telegramConsent) {
      setShowConsentValidation(true);
      return;
    }
    submitLead.mutate({ name, phone, service: "Запись на замер", source: "calculator", ...calculator, personalDataConsent, telegramConsent, consentVersion: PERSONAL_DATA_CONSENT_VERSION, policyVersion: PERSONAL_DATA_CONSENT_VERSION });
  };

  if (!open) return null;
  return (
    <div className="k-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="k-modal">
        <button className="k-modal-close" onClick={onClose} aria-label="Закрыть форму"><X size={20} strokeWidth={ICON_STROKE} /></button>
        <SectionLabel>Смета по вашей площади</SectionLabel>
        <h2 id="modal-title">Получить смету<Dot /></h2>
        <p className="k-modal-copy">Площадь {calculator.area} м², работы — от {calculator.workEstimate.toLocaleString("ru-RU")} ₽. Обсудим задачу, подскажем реалистичный бюджет и подготовим предварительный расчёт за 2 часа.</p>
        <form onSubmit={handleSubmit} className="k-form">
          <div className="field"><label htmlFor="lead-modal-name">Как к вам обращаться</label><input className="ym-record-keys" value={name} id="lead-modal-name" onChange={(e) => setName(e.target.value)} disabled={submitLead.isPending} required placeholder="Ваше имя" /></div>
          <div className="field"><label htmlFor="lead-modal-phone">Телефон</label><input className="ym-record-keys" value={phone} id="lead-modal-phone" type="tel" onChange={(e) => setPhone(e.target.value)} disabled={submitLead.isPending} required placeholder="+7 (___) ___-__-__" /></div>
          <PersonalDataConsent formId="lead-modal" personalDataConsent={personalDataConsent} telegramConsent={telegramConsent} disabled={submitLead.isPending} showValidation={showConsentValidation} onConsentInvalid={() => setShowConsentValidation(true)} onPersonalDataConsentChange={setPersonalDataConsent} onTelegramConsentChange={setTelegramConsent} />
          <button className={submitLead.isPending ? "btn btn-primary k-btn-lg k-btn-block form-submit-loading" : "btn btn-primary k-btn-lg k-btn-block"} type="submit" disabled={submitLead.isPending}>{submitLead.isPending ? <SendingContent label="Отправляем заявку" /> : <>Получить расчёт <ArrowRight size={18} strokeWidth={ICON_STROKE} /></>}</button>
          {submitLead.isError && <p className="form-error">Не удалось отправить заявку. Позвоните нам или повторите попытку.</p>}
        </form>
      </div>
    </div>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [area, setArea] = useState(100);
  const [thankYouName, setThankYouName] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactService, setContactService] = useState("");
  const [contactFile, setContactFile] = useState<File | null>(null);
  const [contactFileError, setContactFileError] = useState("");
  const [contactFileReading, setContactFileReading] = useState(false);
  const [contactPersonalDataConsent, setContactPersonalDataConsent] = useState(false);
  const [contactTelegramConsent, setContactTelegramConsent] = useState(false);
  const [showContactConsentValidation, setShowContactConsentValidation] = useState(false);
  const workRate = 40_000;
  // Materials are not shown on the page; the ratio only feeds the internal estimate sent with a lead.
  const materialsRatio = 0.55;
  const workEstimate = area * workRate;
  const materialsEstimate = Math.round(workEstimate * materialsRatio);
  const totalEstimate = workEstimate + materialsEstimate;
  const calculator = { area, materialLabel: "Рациональный", workEstimate, materialsEstimate, totalEstimate };
  const showThankYou = (name: string) => {
    setLeadOpen(false);
    setThankYouName(name);
  };
  const submitContactLead = trpc.leads.submit.useMutation({
    onSuccess: () => {
      reachLeadGoal("lead_contact");
      showThankYou(contactName);
      setContactName("");
      setContactPhone("");
      setContactService("");
      setContactFile(null);
      setContactFileError("");
      setContactPersonalDataConsent(false);
      setContactTelegramConsent(false);
      setShowContactConsentValidation(false);
    },
  });
  const chooseContactFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared so that choosing the same file again after removing it still fires a change.
    event.target.value = "";
    if (!file) return;
    const problem = designFileProblem(file);
    setContactFileError(problem ?? "");
    setContactFile(problem ? null : file);
  };
  const contactSending = contactFileReading || submitContactLead.isPending;
  const submitContactForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!contactPersonalDataConsent || !contactTelegramConsent) {
      setShowContactConsentValidation(true);
      return;
    }
    let attachment: { fileName: string; data: string } | undefined;
    if (contactFile) {
      setContactFileReading(true);
      try {
        attachment = { fileName: contactFile.name, data: await readFileAsBase64(contactFile) };
      } catch {
        setContactFileError("Не удалось прочитать файл. Выберите его ещё раз или отправьте заявку без файла.");
        return;
      } finally {
        setContactFileReading(false);
      }
    }
    submitContactLead.mutate({ name: contactName, phone: contactPhone, service: contactService, source: "contact", ...calculator, personalDataConsent: contactPersonalDataConsent, telegramConsent: contactTelegramConsent, consentVersion: PERSONAL_DATA_CONSENT_VERSION, policyVersion: PERSONAL_DATA_CONSENT_VERSION, attachment });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") { setLeadOpen(false); setMenuOpen(false); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const openLead = () => { setMenuOpen(false); setLeadOpen(true); };
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="krem-home">
      <header className="k-header">
        <div className="k-header-bar">
          <a className="k-header-brand" href="#top" aria-label="Классный ремонт — главная"><KremLogo /></a>
          <nav className="k-nav" aria-label="Главное меню">
            {navLinks.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
          </nav>
          <a className="k-header-phone" href="tel:+79779480672"><Phone size={16} strokeWidth={ICON_STROKE} />8 (977) 948‑06‑72</a>
          <a className="btn btn-primary k-header-cta" href="#contacts">Получить смету</a>
          <button className="btn btn-secondary btn-icon k-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"} aria-expanded={menuOpen} aria-controls="mobile-menu">{menuOpen ? <X size={22} strokeWidth={ICON_STROKE} /> : <Menu size={22} strokeWidth={ICON_STROKE} />}</button>
        </div>
        {menuOpen && (
          <nav className="k-mobile-menu" id="mobile-menu" aria-label="Мобильное меню">
            {navLinks.map(([href, label]) => <a key={href} href={href} onClick={closeMenu}>{label}</a>)}
            <div className="k-mobile-menu-actions">
              <a className="btn btn-primary k-btn-md" href="#contacts" onClick={closeMenu}>Получить смету по проекту</a>
              <a className="btn btn-secondary k-btn-md" href="tel:+79779480672">8 (977) 948‑06‑72</a>
            </div>
          </nav>
        )}
      </header>

      <main>
        <section id="top" className="k-hero k-container">
          <div className="k-hero-copy">
            <span className="tag tag-accent-2 k-hero-tag"><span></span>Ремонт квартир в Москве</span>
            <h1>Интерьеры, <span className="k-accent">в которые</span> хочется вернуться<Dot /></h1>
            <p className="k-hero-text">Берём на себя весь процесс ремонта — от замера и сметы до чистого объекта с готовыми инженерными системами.</p>
            <div className="k-actions">
              <a className="btn btn-primary k-btn-lg" href="#contacts">Получить смету по проекту<ArrowRight size={18} strokeWidth={ICON_STROKE} /></a>
              <a className="btn btn-secondary k-btn-lg" href="#projects">Смотреть проекты</a>
            </div>
            <div className="k-hero-stats">
              <div><b>12</b><span>лет создаём интерьеры<br />для требовательных клиентов</span></div>
              <div><b>64</b><span>реализованных объекта<br />в Москве и области</span></div>
            </div>
          </div>
          <div className="k-hero-media">
            <div className="k-hero-photo washed"><img src={images.hero} srcSet={siteImages.hero.srcSet} sizes="(min-width: 1100px) 600px, 100vw" width={siteImages.hero.width} height={siteImages.hero.height} alt="Интерьер реализованной гостиной" fetchPriority="high" decoding="async" /></div>
            <span className="k-hero-sage" aria-hidden="true"></span>
            <div className="k-hero-badge"><b>Смета</b><span>за 2 часа</span></div>
          </div>
        </section>

        <section id="trust" className="k-section k-container">
          <div className="k-split k-split-end">
            <div>
              <SectionLabel>Классный ремонт</SectionLabel>
              <h2>Ремонт — это не <span className="k-accent">стресс‑тест</span><Dot /></h2>
            </div>
            <div className="k-stack">
              <p className="k-lead">Мы выстраиваем ремонт так, чтобы у вас в любой момент была ясность: что происходит на объекте, сколько это стоит и когда будет готово.</p>
              <a className="btn btn-ghost k-ghost-link" href="#contacts">Обсудить мой проект<ArrowRight size={18} strokeWidth={ICON_STROKE} /></a>
            </div>
          </div>
          <div className="k-promise-grid">
            <article className="card k-promise"><span className="k-promise-num">01</span><h3>Фиксируем смету</h3><p>Стоимость работ, состав и порядок изменений закрепляем в договоре до старта.</p></article>
            <article className="card k-promise"><span className="k-promise-num">02</span><h3>Контролируем качество</h3><p>Прораб и технический контроль проверяют каждый критичный этап до следующей работы.</p></article>
            <article className="card k-promise"><span className="k-promise-num">03</span><h3>Держим темп</h3><p>Работаем по календарному плану, присылаем отчёт и сразу сообщаем о решениях.</p></article>
            <article className="card k-promise k-promise-dark"><span className="k-promise-num" aria-hidden="true"></span><h3>Не обещаем «за месяц»</h3><p>Качественный ремонт начинается от 4 месяцев. Мы честны со сроками — и соблюдаем их.</p></article>
          </div>
          <div className="k-visit">
            <div><SectionLabel tone="sage">Проверка до договора</SectionLabel><h3>Пригласим вас на объект в работе.</h3></div>
            <div className="k-stack"><p>По предварительной договорённости покажем действующий объект. Вы увидите порядок на площадке, организацию процессов и уровень контроля качества без постановочных кадров.</p><a className="k-visit-link" href="#contacts">Обсудить визит<ArrowRight size={18} strokeWidth={ICON_STROKE} /></a></div>
          </div>
        </section>

        <section id="projects" className="k-section k-container">
          <SectionLabel>Портфолио</SectionLabel>
          <h2>Интерьеры <span className="k-accent">с характером</span><Dot /></h2>
          <div className="k-project-grid">
            {projectCards.map((project) => (
              <article className="k-project" key={project.image}>
                <div className="k-project-photo washed"><img src={project.image} {...imageSize(project.image)} alt={project.title} loading="lazy" decoding="async" /></div>
                <div className="k-project-caption"><h3>{project.title}</h3><p>{project.meta}</p></div>
              </article>
            ))}
          </div>
          <div className="k-pill-note"><span>Хотите обсудить квартиру в похожей стилистике?</span><a className="btn btn-primary k-btn-sm" href="#contacts">Обсудить проект</a></div>
        </section>

        <section id="process" className="k-panel k-process">
          <div className="k-panel-inner">
            <div className="k-split k-split-end">
              <div><SectionLabel>Понятный процесс</SectionLabel><h2>Пять контрольных <span className="k-accent">точек</span><Dot /></h2></div>
              <p className="k-body-lg">Ведём проект через пять контрольных точек. Вы знаете статус работ и принимаете решения вовремя — без постоянного присутствия на объекте.</p>
            </div>
            <div className="k-steps">
              {steps.map(([number, title, text]) => <article className="k-step" key={number}><span className="k-step-num">{number}</span><h3>{title}</h3><p>{text}</p></article>)}
            </div>
            <div className="k-process-action"><div><b>Срок ремонта — от 4 месяцев.</b><span>Точный график составим после замера и согласования проекта.</span></div><a className="btn btn-secondary k-btn-md" href="#contacts">Получить план работ<ArrowRight size={18} strokeWidth={ICON_STROKE} /></a></div>
          </div>
        </section>

        <section id="prices" className="k-section k-container k-prices">
          <div className="k-stack k-stack-lg">
            <div><SectionLabel>Открытая методология</SectionLabel><h2>Понимать бюджет <span className="k-accent">до начала работ</span><Dot /></h2></div>
            <p className="k-body">Стоимость складывается из площади, сложности инженерии и состояния объекта. Мы не называем цену «от балды» — разбираем смету построчно.</p>
            <ul className="k-ticks"><li><span><Check size={15} strokeWidth={ICON_STROKE} /></span>Рациональный ремонт — от 40 000 ₽/м²</li><li><span><Check size={15} strokeWidth={ICON_STROKE} /></span>Материалы — отдельной строкой в смете</li><li><span><Check size={15} strokeWidth={ICON_STROKE} /></span>Мебель и декор — отдельно</li></ul>
          </div>
          <div className="card elev-md k-calc">
            <div className="k-calc-top"><span className="tag tag-accent">Рациональный ремонт</span><span>без материалов, мебели и декора</span></div>
            <div className="k-calc-sum"><span>Стоимость работ</span><output htmlFor="area" aria-live="polite">от {workEstimate.toLocaleString("ru-RU")} ₽</output></div>
            <div className="k-calc-range">
              <div className="k-calc-row"><label htmlFor="area">Площадь квартиры</label><output htmlFor="area">{area} м²</output></div>
              <input id="area" type="range" min="50" max="250" step="5" value={area} onChange={(e) => setArea(Number(e.target.value))} />
              <div className="k-calc-limits"><span>50 м²</span><span>250 м²</span></div>
            </div>
            <div className="k-calc-note">
              <div><span>Стоимость работ</span><b>от {workRate.toLocaleString("ru-RU")} ₽/м²</b></div>
              <div><span>Материалы</span><b>в отдельной строке сметы</b></div>
              <small>Ориентир для рационального уровня отделки. Точную спецификацию закрепим в смете.</small>
            </div>
            <p>Для точного расчёта учтём планировку, инженерные системы и уровень отделки.</p>
            <button className="btn btn-primary k-btn-lg k-btn-block" onClick={openLead}>Получить смету за 2 часа<ArrowRight size={18} strokeWidth={ICON_STROKE} /></button>
          </div>
        </section>

        <section className="k-section k-container">
          <div className="k-heading-row">
            <div><SectionLabel>Отзывы клиентов</SectionLabel><h2>Что говорят <span className="k-accent">клиенты</span><Dot /></h2></div>
            <div className="k-rating"><b>4.9</b><div><span aria-label="5 из 5">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={16} fill="currentColor" strokeWidth={0} />)}</span><small>средняя оценка<br />на независимых площадках</small></div></div>
          </div>
          <div className="k-quotes">
            <figure className="k-quote k-quote-warm"><blockquote>«Ремонт совпал с рождением ребёнка, поэтому особенно ценили, что не нужно ничего держать в голове. Прораб присылал отчёты, всё фиксировал и сам предлагал решения.»</blockquote><figcaption><span className="k-avatar">ЕК</span><span><b>Екатерина К.</b><small>Квартира, 112 м² · ЖК «Садовые кварталы»</small></span></figcaption></figure>
            <figure className="k-quote"><blockquote>«Смета была понятна с первого дня. Когда захотели изменить раскладку плитки, сразу увидели, как это влияет на срок и стоимость. Без недосказанности.»</blockquote><figcaption><span className="k-avatar k-avatar-sage">АМ</span><span><b>Алексей М.</b><small>Апартаменты, 86 м² · Пресня</small></span></figcaption></figure>
          </div>
        </section>

        <section className="k-section k-container k-faq" aria-labelledby="faq-title">
          <div className="k-stack k-stack-lg">
            <div><SectionLabel>Вопросы и ответы</SectionLabel><h2 id="faq-title">О ремонте квартир <span className="k-accent">в Москве — прямо</span><Dot /></h2></div>
            <p className="k-body">Коротко отвечаем на вопросы, которые важно обсудить до старта ремонта. Актуально на сентябрь 2026 года.</p>
          </div>
          <div className="k-faq-list">
            <details name="faq" open><summary>Сколько стоит ремонт квартиры в Москве?<FaqIcon /></summary><p>Стоимость работ начинается от 40 000 ₽ за м². Точный бюджет зависит от площади, состояния квартиры, инженерных решений и состава отделки. Материалы, мебель и декор рассчитываются отдельными строками.</p></details>
            <details name="faq"><summary>Что входит в ремонт под ключ?<FaqIcon /></summary><p>Берём на себя организацию работ, черновую и чистовую отделку, реализацию инженерных систем по проекту, контроль критичных этапов, фотоотчёты и подготовку объекта к приёмке.</p></details>
            <details name="faq"><summary>Как контролируется смета и изменения по ходу работ?<FaqIcon /></summary><p>До старта фиксируем в договоре согласованный объём работ, стоимость и порядок изменений. Если появляется новое решение, сначала показываем его влияние на бюджет и график, затем согласовываем дальнейшие действия.</p></details>
            <details name="faq"><summary>Можно ли увидеть ваш объект до договора?<FaqIcon /></summary><p>Да. По предварительной договорённости пригласим на объект в работе. Вы увидите организацию площадки, порядок на объекте и подход к контролю качества без постановочных кадров.</p></details>
            <details name="faq"><summary>Сколько длится ремонт квартиры?<FaqIcon /></summary><p>Ориентировочный срок качественного ремонта начинается от 4 месяцев. Точный календарный план составляем после замера, оценки инженерных решений и согласования проекта.</p></details>
          </div>
        </section>

        <section id="about" className="k-section k-container k-about">
          <div className="k-about-number"><b>12</b><span><span className="k-about-dot"></span><span>лет</span></span></div>
          <div><SectionLabel>О компании</SectionLabel><h2>За красивым интерьером — <span className="k-accent">сильная система</span><Dot /></h2></div>
          <div className="k-stack k-body"><p>«Классный Ремонт» — команда инженеров, прорабов и мастеров, которая работает с квартирами бизнес- и премиум-класса в Москве.</p><p>Мы не берём десятки объектов одновременно. На каждом проекте есть ответственный прораб, единый чат и план, по которому удобно сверяться.</p></div>
        </section>

        <section id="contacts" className="k-panel k-contacts">
          <div className="k-panel-inner k-contacts-grid">
            <div className="k-stack k-stack-lg">
              <SectionLabel tone="light">Начнём с разговора</SectionLabel>
              <h2>Покажите вашу квартиру. <span className="k-accent-light">Остальное — наша работа</span><Dot /></h2>
              <p className="k-contacts-text">Оставьте контакты — обсудим задачу, назначим замер и пришлём предварительный расчёт за 2 часа.</p>
              <div className="k-contact-pills"><a href="tel:+79779480672"><Phone size={17} strokeWidth={ICON_STROKE} />8 (977) 948‑06‑72</a><a href={TELEGRAM_URL} target="_blank" rel="noreferrer"><Send size={17} strokeWidth={ICON_STROKE} />Telegram</a><a href={WHATSAPP_URL} target="_blank" rel="noreferrer"><MessageCircle size={17} strokeWidth={ICON_STROKE} />WhatsApp</a></div>
            </div>
            <div className="k-form-card">
              <form className="k-form" onSubmit={submitContactForm}>
                <h3>Получить смету по проекту</h3>
                <div className="field"><label htmlFor="contact-name">Ваше имя</label><input className="ym-record-keys" value={contactName} id="contact-name" onChange={(e) => setContactName(e.target.value)} disabled={submitContactLead.isPending} required placeholder="Как к вам обращаться" /></div>
                <div className="field"><label htmlFor="contact-phone">Телефон</label><input className="ym-record-keys" value={contactPhone} id="contact-phone" type="tel" onChange={(e) => setContactPhone(e.target.value)} disabled={submitContactLead.isPending} required placeholder="+7 (___) ___-__-__" /></div>
                <div className="field"><label htmlFor="contact-service">Что планируете?</label><select id="contact-service" value={contactService} onChange={(e) => setContactService(e.target.value)} disabled={submitContactLead.isPending} required><option value="" disabled>Выберите вариант</option><option>Ремонт квартиры под ключ</option><option>Дизайн-проект + ремонт</option><option>Инженерные системы</option><option>Нужна консультация</option></select></div>
                {DESIGN_FILE_UPLOAD_ENABLED && (
                  <div className="k-file-field">
                    <label className={contactFile ? "k-file k-file-chosen" : "k-file"} htmlFor="contact-file">
                      <input id="contact-file" type="file" accept={DESIGN_FILE_ACCEPT} onChange={chooseContactFile} disabled={contactSending} aria-describedby={contactFileError ? "contact-file-error" : undefined} />
                      <span className="k-file-icon"><Paperclip size={16} strokeWidth={ICON_STROKE} /></span>
                      {contactFile ? <span className="k-file-name">{contactFile.name} <span className="k-muted">· {formatFileSize(contactFile.size)}</span></span> : <span>Прикрепить дизайн-проект <span className="k-muted">· PDF, необязательно</span></span>}
                    </label>
                    {contactFile && <button type="button" className="k-file-remove" onClick={() => setContactFile(null)} disabled={contactSending} aria-label="Убрать файл"><X size={16} strokeWidth={ICON_STROKE} /></button>}
                    {contactFileError && <p className="form-error" id="contact-file-error" role="alert">{contactFileError}</p>}
                  </div>
                )}
                <PersonalDataConsent formId="contact-form" personalDataConsent={contactPersonalDataConsent} telegramConsent={contactTelegramConsent} disabled={submitContactLead.isPending} showValidation={showContactConsentValidation} onConsentInvalid={() => setShowContactConsentValidation(true)} onPersonalDataConsentChange={setContactPersonalDataConsent} onTelegramConsentChange={setContactTelegramConsent} />
                <button type="submit" disabled={contactSending} className={contactSending ? "btn btn-primary k-btn-lg k-btn-block form-submit-loading" : "btn btn-primary k-btn-lg k-btn-block"}>{contactSending ? <SendingContent label="Заявка отправляется" /> : <>Отправить заявку <ArrowRight size={18} strokeWidth={ICON_STROKE} /></>}</button>
                {submitContactLead.isError && <p className="form-error">{submitContactLead.error.message === DESIGN_FILE_REJECTED_MESSAGE ? DESIGN_FILE_REJECTED_MESSAGE : "Не удалось отправить заявку. Позвоните нам или повторите попытку."}</p>}
                <small className="k-form-footnote">Без рекламных рассылок. Только ответ по вашему проекту.</small>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="k-footer k-container">
        <div className="k-footer-top">
          <a href="#top" aria-label="Классный ремонт — наверх"><KremLogo size="footer" /></a>
          <nav className="k-footer-links" aria-label="Навигация в подвале"><a href="#projects">Портфолио</a><a href="#process">Процесс</a><a href="#prices">Цены</a><a href="/blog">Блог</a><a href="#contacts">Контакты</a></nav>
        </div>
        <div className="k-legal" aria-label="Реквизиты индивидуального предпринимателя"><span>ИП Бережной Егор Юрьевич</span><span><small>ОГРНИП</small><b>321527500117786</b></span><span><small>ИНН</small><b>773166101203</b></span><span><small>ОКПО</small><b>2011448980</b></span></div>
        <div className="k-footer-bottom"><span>© 2026 ИП Бережной Егор Юрьевич</span><a href="/privacy-policy">Политика обработки персональных данных</a><a href="/personal-data-consent">Согласие на обработку данных</a><span>Москва · ремонт квартир под ключ</span><a href="#top">Наверх ↑</a></div>
      </footer>

      <LeadModal open={leadOpen} onClose={() => setLeadOpen(false)} onSuccess={showThankYou} calculator={calculator} />
      <ThankYouModal name={thankYouName} onClose={() => setThankYouName(null)} />
    </div>
  );
}

function FaqIcon() {
  return <span className="k-faq-icon" aria-hidden="true"><Plus className="k-faq-plus" size={18} strokeWidth={ICON_STROKE} /><Minus className="k-faq-minus" size={18} strokeWidth={ICON_STROKE} /></span>;
}
