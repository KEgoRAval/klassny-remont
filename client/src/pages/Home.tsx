import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  FileCheck2,
  Instagram,
  Menu,
  MessageCircle,
  Phone,
  Ruler,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PERSONAL_DATA_CONSENT_VERSION, PersonalDataConsent } from "@/components/PersonalDataConsent";
import { TELEGRAM_URL, WHATSAPP_URL } from "@/components/MessengerQuickActions";

const images = {
  hero: "/manus-storage/hero-living-room_277d141a.jpg",
  veryLiving: "/manus-storage/very-enhanced-living_6019bd19.png",
  veryEntry: "/manus-storage/very-enhanced-entry_0f41baa0.png",
  veryBedroom: "/manus-storage/very-enhanced-bedroom_262c2040.png",
  veryBathroom: "/manus-storage/very-enhanced-bathroom_c918e00d.png",
  everLiving: "/manus-storage/ever-enhanced-living_6eb96fe0.png",
  everEntry: "/manus-storage/ever-enhanced-entry_054ed219.png",
  everBedroom: "/manus-storage/ever-enhanced-bedroom_5f368637.png",
  everShower: "/manus-storage/ever-enhanced-shower_967e9d92.png",
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="section-label"><span></span>{children}</div>;
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
    <div className="thankyou-backdrop" role="dialog" aria-modal="true" aria-labelledby="thankyou-title" onMouseDown={onClose}>
      <div className="thankyou-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Закрыть окно благодарности"><X size={20} /></button>
        <div className="thankyou-orbit" aria-hidden="true"><span className="thankyou-check"><Check size={27} strokeWidth={2.4} /></span></div>
        <p className="eyebrow">Заявка уже у команды</p>
        <h2 id="thankyou-title">Спасибо,<br />{name}.</h2>
        <p>Получили контакты и параметры расчёта. Свяжемся с вами в рабочее время, уточним детали и предложим удобное время для замера.</p>
        <div className="thankyou-details"><span>01</span><span>Ответ по заявке</span><b>в течение 24 часов</b></div>
        <button className="button button-dark" onClick={onClose}>Вернуться на сайт <ArrowRight size={17} /></button>
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
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="lead-modal">
        <button className="modal-close" onClick={onClose} aria-label="Закрыть форму"><X size={20} /></button>
        <p className="eyebrow">Первый шаг к ремонту без сюрпризов</p>
        <h2 id="modal-title">Запишитесь на замер</h2>
        <p className="modal-copy">Обсудим задачу, подскажем реалистичный бюджет и подготовим предварительный расчёт за 24 часа.</p>
        <form onSubmit={handleSubmit} className="modal-form">
          <label>Как к вам обращаться<input value={name} onChange={(e) => setName(e.target.value)} disabled={submitLead.isPending} required placeholder="Ваше имя" /></label>
          <label>Телефон<input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={submitLead.isPending} required placeholder="+7 (___) ___-__-__" /></label>
          <PersonalDataConsent formId="lead-modal" personalDataConsent={personalDataConsent} telegramConsent={telegramConsent} disabled={submitLead.isPending} showValidation={showConsentValidation} onConsentInvalid={() => setShowConsentValidation(true)} onPersonalDataConsentChange={setPersonalDataConsent} onTelegramConsentChange={setTelegramConsent} />
          <button className={submitLead.isPending ? "button button-brass form-submit-loading" : "button button-brass"} type="submit" disabled={submitLead.isPending}>{submitLead.isPending ? <SendingContent label="Отправляем заявку" /> : <>Получить расчёт <ArrowRight size={17} /></>}</button>
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
  const [contactPersonalDataConsent, setContactPersonalDataConsent] = useState(false);
  const [contactTelegramConsent, setContactTelegramConsent] = useState(false);
  const [showContactConsentValidation, setShowContactConsentValidation] = useState(false);
  const workRate = 40_000;
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
      showThankYou(contactName);
      setContactName("");
      setContactPhone("");
      setContactService("");
      setContactPersonalDataConsent(false);
      setContactTelegramConsent(false);
      setShowContactConsentValidation(false);
    },
  });
  const submitContactForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!contactPersonalDataConsent || !contactTelegramConsent) {
      setShowContactConsentValidation(true);
      return;
    }
    submitContactLead.mutate({ name: contactName, phone: contactPhone, service: contactService, source: "contact", ...calculator, personalDataConsent: contactPersonalDataConsent, telegramConsent: contactTelegramConsent, consentVersion: PERSONAL_DATA_CONSENT_VERSION, policyVersion: PERSONAL_DATA_CONSENT_VERSION });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") { setLeadOpen(false); setMenuOpen(false); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const openLead = () => { setMenuOpen(false); setLeadOpen(true); };

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Классный Ремонт — главная">
          <span className="brand-mark">КР</span>
          <span><b>Классный</b><em>Ремонт</em></span>
        </a>
        <nav className={menuOpen ? "nav nav-open" : "nav"} aria-label="Главное меню">
          <a href="#projects" onClick={() => setMenuOpen(false)}>Проекты</a>
          <a href="#process" onClick={() => setMenuOpen(false)}>Процесс</a>
          <a href="#prices" onClick={() => setMenuOpen(false)}>Цены</a>
          <a href="/blog" onClick={() => setMenuOpen(false)}>Блог</a>
          <a href="#about" onClick={() => setMenuOpen(false)}>О компании</a>
          <a href="#contacts" onClick={() => setMenuOpen(false)}>Контакты</a>
        </nav>
        <div className="topbar-actions">
          <a className="header-phone" href="tel:+79779480672"><Phone size={15} /> 8 (977) 948‑06‑72</a>
          <button className="small-cta" onClick={openLead}>Оставить заявку <ArrowDownRight size={16} /></button>
          <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Открыть меню">{menuOpen ? <X /> : <Menu />}</button>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <img src={images.hero} alt="Интерьер реализованной гостиной" className="hero-image" />
          <div className="hero-overlay"></div>
          <div className="hero-content">
            <div className="hero-kicker"><span className="pulse-dot"></span> Ремонт квартир в Москве</div>
            <h1>Интерьеры,<br /><i>в которые</i><br />хочется вернуться.</h1>
            <p className="hero-text">Берём на себя весь процесс ремонта — от замера и сметы до чистого объекта с готовыми инженерными системами.</p>
            <div className="hero-actions">
              <button onClick={openLead} className="button button-brass">Оставить заявку на замер <ArrowRight size={18} /></button>
              <a href="#projects" className="text-link">Смотреть проекты <ArrowDownRight size={17} /></a>
            </div>
          </div>
          <div className="hero-bottom">
            <div><b>12 лет</b><span>создаём интерьеры<br />для требовательных клиентов</span></div>
            <div><b>64</b><span>реализованных объекта<br />в Москве и области</span></div>
            <a href="#trust" className="hero-scroll">Листайте, чтобы узнать больше <ChevronDown size={18} /></a>
          </div>
        </section>

        <section id="trust" className="trust section-padding">
          <div className="content-grid intro-grid">
            <div>
              <SectionLabel>Классный Ремонт</SectionLabel>
              <h2>Ремонт — это не<br /><i>стресс‑тест.</i></h2>
            </div>
            <div className="intro-copy">
              <p className="large-copy">Мы выстраиваем ремонт так, чтобы у вас в любой момент была ясность: что происходит на объекте, сколько это стоит и когда будет готово.</p>
              <button className="underlined-button" onClick={openLead}>Обсудить мой проект <ArrowRight size={17} /></button>
            </div>
          </div>
          <div className="promise-grid">
            <article className="promise-card"><div className="promise-icon"><FileCheck2 /></div><span>01</span><h3>Фиксируем смету</h3><p>Стоимость работ, состав и порядок изменений закрепляем в договоре до старта.</p></article>
            <article className="promise-card"><div className="promise-icon"><ShieldCheck /></div><span>02</span><h3>Контролируем качество</h3><p>Прораб и технический контроль проверяют каждый критичный этап до следующей работы.</p></article>
            <article className="promise-card"><div className="promise-icon"><Clock3 /></div><span>03</span><h3>Держим темп</h3><p>Работаем по календарному плану, присылаем отчёт и сразу сообщаем о решениях.</p></article>
            <article className="promise-card dark-card"><Sparkles size={27} /><h3>Не обещаем «за месяц»</h3><p>Качественный ремонт начинается от 4 месяцев. Мы честны со сроками — и соблюдаем их.</p></article>
          </div>
          <div className="site-visit">
            <div><SectionLabel>Проверка до договора</SectionLabel><h3>Пригласим вас<br /><i>на объект в работе.</i></h3></div>
            <div><p>По предварительной договорённости покажем действующий объект. Вы увидите порядок на площадке, организацию процессов и уровень контроля качества без постановочных кадров.</p><a className="text-link dark-link" href="#contacts">Обсудить визит <ArrowRight size={17} /></a></div>
          </div>
        </section>

        <section id="projects" className="projects section-padding">
          <div className="section-heading">
            <div><SectionLabel>Портфолио</SectionLabel><h2>Интерьеры<br /><i>с характером.</i></h2></div>
          </div>
          <div className="project-grid">
            {projectCards.map((project, index) => (
              <article className={`project-card project-${index + 1}`} key={project.image}>
                <img src={project.image} alt={project.title} loading="lazy" />
                <div className="project-shade"></div>
                <div className="project-meta"><button aria-label={`Открыть ${project.title}`} onClick={openLead}><ArrowUpRightIcon /></button></div>
                <div className="project-title"><h3>{project.title}</h3><p>{project.meta}</p></div>
              </article>
            ))}
          </div>
          <div className="portfolio-note"><Ruler size={18} /><span>Хотите обсудить квартиру в похожей стилистике?</span><button onClick={openLead}>Обсудить проект</button></div>
        </section>

        <section id="process" className="process section-padding">
          <div className="process-header"><SectionLabel>Понятный процесс</SectionLabel><p>Ведём проект через пять контрольных точек. Вы знаете статус работ и принимаете решения вовремя — без постоянного присутствия на объекте.</p></div>
          <div className="process-list">
            {steps.map(([number, title, text]) => <article className="process-row" key={number}><span className="step-number">{number}</span><h3>{title}</h3><p>{text}</p><ArrowRight className="process-arrow" size={19} /></article>)}
          </div>
          <div className="process-action"><div><b>Срок ремонта — от 4 месяцев.</b><span>Точный график составим после замера и согласования проекта.</span></div><button className="button button-outline-light" onClick={openLead}>Получить план работ <ArrowRight size={17} /></button></div>
        </section>

        <section id="prices" className="estimate section-padding">
          <div className="estimate-content">
            <div><SectionLabel>Открытая методология</SectionLabel><h2>Понимать бюджет<br /><i>до начала работ.</i></h2><p>Стоимость складывается из площади, сложности инженерии и состояния объекта. Мы не называем цену «от балды» — разбираем смету построчно.</p><ul className="tick-list"><li><Check size={16} />Рациональный ремонт — от 40 000 ₽/м²</li><li><Check size={16} />Материалы — отдельной строкой в смете</li><li><Check size={16} />Мебель и декор — отдельно</li></ul></div>
            <div className="calculator-card">
              <div className="calc-top"><span>Рациональный ремонт</span><span>без мебели и декора</span></div>
              <div className="estimate-price">от {totalEstimate.toLocaleString("ru-RU")} ₽</div>
              <div className="range-row"><label htmlFor="area">Площадь квартиры</label><output>{area} м²</output></div>
              <input id="area" type="range" min="50" max="250" step="5" value={area} onChange={(e) => setArea(Number(e.target.value))} style={{ "--value": `${((area - 50) / 200) * 100}%` } as React.CSSProperties} />
              <div className="range-labels"><span>50 м²</span><span>250 м²</span></div>
              <div className="material-field">
                <div className="range-row"><span>Стоимость работ</span><output>от {workRate.toLocaleString("ru-RU")} ₽/м²</output></div>
                <div className="materials-note"><span>Материалы</span><b>в отдельной строке сметы</b></div>
                <small>Ориентир для рационального уровня отделки. Точную спецификацию закрепим в смете.</small>
              </div>
              <div className="calc-divider"></div>
              <div className="calc-breakdown"><div><span>Работы</span><b>от {workEstimate.toLocaleString("ru-RU")} ₽</b></div><div><span>Материалы</span><b>от {materialsEstimate.toLocaleString("ru-RU")} ₽</b></div></div>
              <p>Для точного расчёта учтём планировку, инженерные системы и уровень отделки.</p>
              <button className="button button-brass full-width" onClick={openLead}>Получить смету за 24 часа <ArrowRight size={18} /></button>
            </div>
          </div>
        </section>

        <section className="reviews section-padding">
          <div className="review-heading"><SectionLabel>Отзывы клиентов</SectionLabel><div className="rating"><b>4.9</b><span>{[1,2,3,4,5].map((i) => <Star key={i} size={16} fill="currentColor" />)}</span><small>средняя оценка на независимых площадках</small></div></div>
          <div className="quote-grid">
            <figure className="quote-card featured-quote"><blockquote>«Ремонт совпал с рождением ребёнка, поэтому особенно ценили, что не нужно ничего держать в голове. Прораб присылал отчёты, всё фиксировал и сам предлагал решения.»</blockquote><figcaption><span className="avatar">ЕК</span><div><b>Екатерина К.</b><small>Квартира, 112 м² · ЖК «Садовые кварталы»</small></div></figcaption></figure>
            <figure className="quote-card"><blockquote>«Смета была понятна с первого дня. Когда захотели изменить раскладку плитки, сразу увидели, как это влияет на срок и стоимость. Без недосказанности.»</blockquote><figcaption><span className="avatar warm">АМ</span><div><b>Алексей М.</b><small>Апартаменты, 86 м² · Пресня</small></div></figcaption></figure>
          </div>
        </section>

        <section className="faq section-padding" aria-labelledby="faq-title">
          <div className="faq-intro"><SectionLabel>Вопросы и ответы</SectionLabel><h2 id="faq-title">О ремонте квартир<br /><i>в Москве — прямо.</i></h2><p>Коротко отвечаем на вопросы, которые важно обсудить до старта ремонта. Актуально на сентябрь 2026 года.</p></div>
          <div className="faq-list">
            <details open><summary>Сколько стоит ремонт квартиры в Москве?<ArrowDownRight size={20} /></summary><p>Стоимость работ начинается от 40 000 ₽ за м². Точный бюджет зависит от площади, состояния квартиры, инженерных решений и состава отделки. Материалы, мебель и декор рассчитываются отдельными строками.</p></details>
            <details><summary>Что входит в ремонт под ключ?<ArrowDownRight size={20} /></summary><p>Берём на себя организацию работ, черновую и чистовую отделку, реализацию инженерных систем по проекту, контроль критичных этапов, фотоотчёты и подготовку объекта к приёмке.</p></details>
            <details><summary>Как контролируется смета и изменения по ходу работ?<ArrowDownRight size={20} /></summary><p>До старта фиксируем в договоре согласованный объём работ, стоимость и порядок изменений. Если появляется новое решение, сначала показываем его влияние на бюджет и график, затем согласовываем дальнейшие действия.</p></details>
            <details><summary>Можно ли увидеть ваш объект до договора?<ArrowDownRight size={20} /></summary><p>Да. По предварительной договорённости пригласим на объект в работе. Вы увидите организацию площадки, порядок на объекте и подход к контролю качества без постановочных кадров.</p></details>
            <details><summary>Сколько длится ремонт квартиры?</summary><p>Ориентировочный срок качественного ремонта начинается от 4 месяцев. Точный календарный план составляем после замера, оценки инженерных решений и согласования проекта.</p></details>
          </div>
        </section>

        <section id="about" className="about section-padding">
          <div className="about-grid"><div className="about-number">12<span>лет</span></div><div><SectionLabel>О компании</SectionLabel><h2>За красивым<br />интерьером —<br /><i>сильная система.</i></h2></div><div className="about-copy"><p>«Классный Ремонт» — команда инженеров, прорабов и мастеров, которая работает с квартирами бизнес- и премиум-класса в Москве.</p><p>Мы не берём десятки объектов одновременно. На каждом проекте есть ответственный прораб, единый чат и план, по которому удобно сверяться.</p></div></div>
        </section>

        <section id="contacts" className="contact-section">
          <div className="contact-panel">
            <div className="contact-copy"><SectionLabel>Начнём с разговора</SectionLabel><h2>Покажите<br />вашу квартиру.<br /><i>Остальное — наша<br />работа.</i></h2><p>Оставьте контакты — обсудим задачу, назначим замер и пришлём предварительный расчёт за 24 часа.</p><div className="contact-direct"><a href="tel:+79779480672"><Phone size={18} />8 (977) 948‑06‑72</a><a href={TELEGRAM_URL} target="_blank" rel="noreferrer"><Send size={18} />Telegram</a><a href={WHATSAPP_URL} target="_blank" rel="noreferrer"><MessageCircle size={18} />WhatsApp</a></div></div>
            <div className="contact-form-wrap">
              <form className="contact-form" onSubmit={submitContactForm}>
                <label>Ваше имя<input value={contactName} onChange={(e) => setContactName(e.target.value)} disabled={submitContactLead.isPending} required placeholder="Как к вам обращаться" /></label>
                <label>Телефон<input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} disabled={submitContactLead.isPending} required placeholder="+7 (___) ___-__-__" /></label>
                <label>Что планируете?<select value={contactService} onChange={(e) => setContactService(e.target.value)} disabled={submitContactLead.isPending} required><option value="" disabled>Выберите вариант</option><option>Ремонт квартиры под ключ</option><option>Дизайн-проект + ремонт</option><option>Инженерные системы</option><option>Нужна консультация</option></select></label>
                <PersonalDataConsent formId="contact-form" personalDataConsent={contactPersonalDataConsent} telegramConsent={contactTelegramConsent} disabled={submitContactLead.isPending} showValidation={showContactConsentValidation} onConsentInvalid={() => setShowContactConsentValidation(true)} onPersonalDataConsentChange={setContactPersonalDataConsent} onTelegramConsentChange={setContactTelegramConsent} />
                <button type="submit" disabled={submitContactLead.isPending} className={submitContactLead.isPending ? "button button-brass full-width form-submit-loading" : "button button-brass full-width"}>{submitContactLead.isPending ? <SendingContent label="Заявка отправляется" /> : <>Отправить заявку <ArrowRight size={18} /></>}</button>
                {submitContactLead.isError && <p className="form-error">Не удалось отправить заявку. Позвоните нам или повторите попытку.</p>}
                <small>Без рекламных рассылок. Только ответ по вашему проекту.</small>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer><div className="footer-brand"><span className="brand-mark">КР</span><span><b>Классный</b><em>Ремонт</em></span></div><div className="footer-links"><a href="#projects">Портфолио</a><a href="#process">Процесс</a><a href="#prices">Цены</a><a href="/blog">Блог</a><a href="#contacts">Контакты</a></div><div className="legal-details" aria-label="Реквизиты индивидуального предпринимателя"><span>ИП Бережной Егор Юрьевич</span><div><small>ОГРНИП</small><b>321527500117786</b></div><div><small>ИНН</small><b>773166101203</b></div><div><small>ОКПО</small><b>2011448980</b></div></div><div className="privacy-links"><a href="/privacy-policy">Политика обработки персональных данных</a><a href="/personal-data-consent">Согласие на обработку данных</a></div><div className="footer-bottom"><span>© 2026 ИП Бережной Егор Юрьевич</span><span>Москва · ремонт квартир под ключ</span><a href="#top">Наверх ↑</a></div></footer>

      <LeadModal open={leadOpen} onClose={() => setLeadOpen(false)} onSuccess={showThankYou} calculator={calculator} />
      <ThankYouModal name={thankYouName} onClose={() => setThankYouName(null)} />
    </div>
  );
}

function ArrowUpRightIcon() { return <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M8 7h9v9" /></svg>; }
