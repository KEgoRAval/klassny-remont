import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  FileCheck2,
  Grid2X2,
  Menu,
  Phone,
  Ruler,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { PERSONAL_DATA_CONSENT_VERSION, PersonalDataConsent } from "@/components/PersonalDataConsent";

const images = {
  hero: "/manus-storage/hero-living-room_277d141a.jpg",
  veryLiving: "/manus-storage/very-enhanced-living_6019bd19.png",
  veryEntry: "/manus-storage/very-enhanced-entry_0f41baa0.png",
  veryBedroom: "/manus-storage/very-enhanced-bedroom_262c2040.png",
  everLiving: "/manus-storage/ever-enhanced-living_6eb96fe0.png",
};

const projects = [
  { image: images.veryLiving, name: "ЖК Very", meta: "Кухня-гостиная · 86 м²", size: "large" },
  { image: images.everLiving, name: "ЖК Ever", meta: "Гостиная · 64 м²", size: "standard" },
  { image: images.veryBedroom, name: "ЖК Остров", meta: "Спальня · 24 м²", size: "standard" },
  { image: images.veryEntry, name: "ЖК Level", meta: "Прихожая · 18 м²", size: "wide" },
];

const steps = [
  ["01", "Замер и задача", "Фиксируем геометрию, бюджет и технические ограничения на старте."],
  ["02", "Смета и план", "Собираем понятную смету с этапами, сроками и зонами ответственности."],
  ["03", "Проектирование", "Синхронизируем дизайн, инженерные решения и спецификации до работ."],
  ["04", "Реализация", "Ведём объект по календарному плану, с фотоотчётами и технадзором."],
  ["05", "Приёмка", "Сдаём объект по чек-листу и остаёмся на связи после переезда."],
];

const logos = ["S7", "Яндекс", "VK", "ПИК", "Level", "Ozon", "RBI", "M2", "AFI", "MR Group", "Vesper", "Sminex"];

function SectionTag({ children }: { children: ReactNode }) {
  return <div className="planpoint-tag"><span />{children}</div>;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value) + " ₽";
}

type CalculatorDetails = {
  area: number;
  materialLabel: string;
  workEstimate: number;
  materialsEstimate: number;
  totalEstimate: number;
};

function SendingContent({ label }: { label: string }) {
  return <><span className="button-loader" aria-hidden="true"><i /><i /><i /></span><span>{label}</span></>;
}

function ThankYouModal({ name, onClose }: { name: string | null; onClose: () => void }) {
  if (!name) return null;
  return (
    <div className="planpoint-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="thanks-title" onMouseDown={onClose}>
      <div className="planpoint-thanks" onMouseDown={(event) => event.stopPropagation()}>
        <button className="planpoint-modal-close" onClick={onClose} aria-label="Закрыть окно"><X size={19} /></button>
        <div className="thanks-mark"><Check size={25} /></div>
        <SectionTag>Заявка уже у команды</SectionTag>
        <h2 id="thanks-title">Спасибо,<br />{name}.</h2>
        <p>Получили контакты и параметры расчёта. Свяжемся с вами в рабочее время, уточним детали и предложим удобное время для замера.</p>
        <div className="thanks-detail"><span>01</span><span>Ответ по заявке</span><b>в течение 24 часов</b></div>
        <button className="planpoint-button planpoint-button-dark" onClick={onClose}>Вернуться на сайт <ArrowRight size={16} /></button>
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

  if (!open) return null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!personalDataConsent || !telegramConsent) {
      setShowConsentValidation(true);
      return;
    }
    submitLead.mutate({
      name,
      phone,
      service: "Запись на замер",
      source: "calculator",
      ...calculator,
      personalDataConsent,
      telegramConsent,
      consentVersion: PERSONAL_DATA_CONSENT_VERSION,
      policyVersion: PERSONAL_DATA_CONSENT_VERSION,
    });
  };

  return (
    <div className="planpoint-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="lead-title" onMouseDown={onClose}>
      <div className="planpoint-lead-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button className="planpoint-modal-close" onClick={onClose} aria-label="Закрыть форму"><X size={19} /></button>
        <SectionTag>Первый шаг к ремонту без сюрпризов</SectionTag>
        <h2 id="lead-title">Запишитесь<br />на замер.</h2>
        <p className="planpoint-modal-copy">Обсудим задачу, подскажем реалистичный бюджет и подготовим предварительный расчёт за 24 часа.</p>
        <form onSubmit={handleSubmit} className="planpoint-form">
          <label>Как к вам обращаться<input value={name} onChange={(event) => setName(event.target.value)} disabled={submitLead.isPending} required placeholder="Ваше имя" /></label>
          <label>Телефон<input value={phone} onChange={(event) => setPhone(event.target.value)} disabled={submitLead.isPending} required placeholder="+7 (___) ___-__-__" /></label>
          <PersonalDataConsent formId="planpoint-lead-modal" personalDataConsent={personalDataConsent} telegramConsent={telegramConsent} disabled={submitLead.isPending} showValidation={showConsentValidation} onConsentInvalid={() => setShowConsentValidation(true)} onPersonalDataConsentChange={setPersonalDataConsent} onTelegramConsentChange={setTelegramConsent} />
          <button className="planpoint-button planpoint-button-primary planpoint-submit" type="submit" disabled={submitLead.isPending}>{submitLead.isPending ? <SendingContent label="Отправляем заявку" /> : <>Получить расчёт <ArrowRight size={16} /></>}</button>
          {submitLead.isError && <p className="planpoint-form-error">Не удалось отправить заявку. Позвоните нам или повторите попытку.</p>}
        </form>
      </div>
    </div>
  );
}

function DemoCard({ onOpenLead }: { onOpenLead: () => void }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="planpoint-blue-frame">
      <div className="blue-frame-top"><span>PLANPOINT / CASE 024</span><span>01 — 06</span></div>
      <div className="blueprint-window">
        <img src={images.hero} alt="Интерьер реализованной гостиной" />
        <div className="blueprint-grid" aria-hidden="true" />
        <div className="blueprint-label blueprint-label-a">КУХНЯ · 14.2 м²</div>
        <div className="blueprint-label blueprint-label-b">СВЕТ · 06</div>
        <div className="blueprint-scale"><span>0</span><i /><span>5 m</span></div>
        <button className={playing ? "demo-play demo-play-active" : "demo-play"} onClick={() => setPlaying((value) => !value)} aria-label={playing ? "Поставить демо на паузу" : "Запустить демо-план"}>
          {playing ? <span className="demo-pause" /> : <span className="demo-triangle" />}
        </button>
        {playing && <div className="demo-note"><Grid2X2 size={15} /> Демо-план открыт</div>}
      </div>
      <div className="blue-frame-bottom"><span>СМОТРЕТЬ, КАК МЫ РАБОТАЕМ</span><button onClick={onOpenLead}>Запросить разбор проекта <ArrowUpRight size={16} /></button></div>
    </div>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [thankYouName, setThankYouName] = useState<string | null>(null);
  const [area, setArea] = useState(100);
  const [materialMode, setMaterialMode] = useState<"Рациональный" | "Премиум">("Рациональный");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactService, setContactService] = useState("Ремонт квартиры");
  const [contactPersonalDataConsent, setContactPersonalDataConsent] = useState(false);
  const [contactTelegramConsent, setContactTelegramConsent] = useState(false);
  const [showContactConsentValidation, setShowContactConsentValidation] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);

  const workEstimate = area * 40_000;
  const materialsEstimate = Math.round(workEstimate * (materialMode === "Премиум" ? 0.85 : 0.55));
  const totalEstimate = workEstimate + materialsEstimate;
  const calculator = { area, materialLabel: materialMode, workEstimate, materialsEstimate, totalEstimate };
  const submitContactLead = trpc.leads.submit.useMutation({
    onSuccess: () => {
      setContactSent(true);
      setContactName("");
      setContactPhone("");
      setContactPersonalDataConsent(false);
      setContactTelegramConsent(false);
      setShowContactConsentValidation(false);
    },
  });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLeadOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const openLead = () => {
    setMenuOpen(false);
    setLeadOpen(true);
  };

  const submitContactForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!contactPersonalDataConsent || !contactTelegramConsent) {
      setShowContactConsentValidation(true);
      return;
    }
    submitContactLead.mutate({
      name: contactName,
      phone: contactPhone,
      service: contactService,
      source: "contact",
      ...calculator,
      personalDataConsent: contactPersonalDataConsent,
      telegramConsent: contactTelegramConsent,
      consentVersion: PERSONAL_DATA_CONSENT_VERSION,
      policyVersion: PERSONAL_DATA_CONSENT_VERSION,
    });
  };

  return (
    <div className="planpoint-shell">
      <header className="planpoint-nav">
        <a href="#top" className="planpoint-brand" aria-label="Классный Ремонт — главная">
          <span className="planpoint-logo"><i /><i /></span>
          <span><b>Классный</b><em>Ремонт</em></span>
        </a>
        <nav className={menuOpen ? "planpoint-nav-links planpoint-nav-links-open" : "planpoint-nav-links"} aria-label="Главное меню">
          <a href="#projects" onClick={() => setMenuOpen(false)}>Проекты</a>
          <a href="#process" onClick={() => setMenuOpen(false)}>Процесс</a>
          <a href="#prices" onClick={() => setMenuOpen(false)}>Цены</a>
          <a href="#about" onClick={() => setMenuOpen(false)}>О компании</a>
          <a href="#contact" onClick={() => setMenuOpen(false)}>Контакты</a>
        </nav>
        <div className="planpoint-nav-actions">
          <a className="planpoint-support" href="tel:+79779480672"><Phone size={15} /> 8 (977) 948-06-72</a>
          <button className="planpoint-button planpoint-button-dark nav-cta" onClick={openLead}>Записаться <ArrowUpRight size={15} /></button>
          <button className="planpoint-menu-button" onClick={() => setMenuOpen((value) => !value)} aria-label="Открыть меню">{menuOpen ? <X /> : <Menu />}</button>
        </div>
      </header>

      <main id="top">
        <section className="planpoint-hero">
          <div className="planpoint-hero-copy">
            <div className="planpoint-badge"><span>New</span> Смета как понятный план</div>
            <h1>Ремонт, который<br /><i>начинается</i> с ясного плана.</h1>
            <p>Проектируем и реализуем интерьеры квартир в Москве. Показываем, что происходит на объекте, сколько это стоит и когда будет готово.</p>
            <div className="planpoint-hero-actions"><button onClick={openLead} className="planpoint-button planpoint-button-primary">Записаться на замер <ArrowRight size={17} /></button><a className="planpoint-text-button" href="#projects">Смотреть проекты <ArrowDownRightIcon /></a></div>
          </div>
          <DemoCard onOpenLead={openLead} />
          <div className="planpoint-hero-foot"><span><b>12 лет</b> создаём интерьеры для требовательных клиентов</span><span><b>64</b> реализованных объекта в Москве и области</span><a href="#trust">Листайте, чтобы узнать больше <ChevronDown size={16} /></a></div>
        </section>

        <section id="trust" className="planpoint-section planpoint-trust">
          <div className="planpoint-two-col planpoint-intro">
            <div><SectionTag>Классный Ремонт</SectionTag><h2>Ремонт — это не<br /><i>стресс-тест.</i></h2></div>
            <div className="planpoint-intro-copy"><p>Мы выстраиваем ремонт так, чтобы у вас в любой момент была ясность: что происходит на объекте, сколько это стоит и когда будет готово.</p><button className="planpoint-link-button" onClick={openLead}>Обсудить мой проект <ArrowRight size={16} /></button></div>
          </div>
          <div className="planpoint-feature-grid">
            <article className="planpoint-feature-card"><FileCheck2 /><span>01</span><h3>Фиксируем смету</h3><p>Стоимость работ, состав и порядок изменений закрепляем в договоре до старта.</p></article>
            <article className="planpoint-feature-card"><ShieldCheck /><span>02</span><h3>Контролируем качество</h3><p>Прораб и технический контроль проверяют каждый критичный этап до следующей работы.</p></article>
            <article className="planpoint-feature-card"><Ruler /><span>03</span><h3>Держим масштаб</h3><p>Работаем с чертежами, замерами и спецификациями, а не с обещаниями на словах.</p></article>
            <article className="planpoint-feature-card planpoint-feature-dark"><Sparkles /><h3>План вместо стресса</h3><p>Качественный ремонт начинается с честного разговора о сроках, бюджете и решениях.</p></article>
          </div>
        </section>

        <section className="planpoint-trust-cloud">
          <SectionTag>Нам доверяют</SectionTag>
          <h2>Уверенный план —<br />спокойный результат.</h2>
          <div className="planpoint-logo-cloud">{logos.map((logo) => <span key={logo}>{logo}</span>)}</div>
        </section>

        <section id="projects" className="planpoint-section planpoint-projects">
          <div className="planpoint-section-heading"><div><SectionTag>Избранные проекты</SectionTag><h2>Сделано<br /><i>с вниманием.</i></h2></div><a className="planpoint-link-button" href="#contact">Обсудить свой объект <ArrowUpRight size={16} /></a></div>
          <div className="planpoint-project-grid">{projects.map((project) => <article key={project.name} className={`planpoint-project-card planpoint-project-${project.size}`}><img src={project.image} alt={`${project.name} — ${project.meta}`} /><div className="planpoint-project-shade" /><div className="planpoint-project-meta"><span>CASE / 0{projects.indexOf(project) + 1}</span><ArrowUpRight size={17} /></div><div className="planpoint-project-title"><h3>{project.name}</h3><p>{project.meta}</p></div></article>)}</div>
          <div className="planpoint-project-note"><Grid2X2 size={17} /> <span>Каждый проект начинается с плана, а заканчивается пространством, в которое хочется вернуться.</span><button onClick={openLead}>Получить разбор <ArrowRight size={16} /></button></div>
        </section>

        <section id="process" className="planpoint-section planpoint-process">
          <div className="planpoint-process-heading"><div><SectionTag>Рабочий процесс</SectionTag><h2>Пять шагов<br /><i>до дома.</i></h2></div><p>Без хаоса, непонятных доплат и исчезающих подрядчиков. Вы видите ход проекта и понимаете, что будет дальше.</p></div>
          <div className="planpoint-process-list">{steps.map(([number, title, text]) => <div className="planpoint-process-row" key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p><ArrowRight className="process-arrow" size={18} /></div>)}</div>
          <div className="planpoint-process-foot"><div><b>Прозрачность на каждом этапе</b><span>Фотоотчёты, календарный план и живой контакт с командой.</span></div><button className="planpoint-button planpoint-button-outline-light" onClick={openLead}>Собрать мой план <ArrowRight size={16} /></button></div>
        </section>

        <section id="prices" className="planpoint-section planpoint-estimate">
          <div className="planpoint-estimate-copy"><SectionTag>Предварительная оценка</SectionTag><h2>Понимайте<br /><i>масштаб.</i></h2><p>Измените площадь и уровень материалов — получите ориентир для разговора с командой. Точная смета появляется после замера.</p><ul><li><Check size={16} /> Без скрытых коэффициентов</li><li><Check size={16} /> Фиксируем состав работ</li><li><Check size={16} /> Ответим за 24 часа</li></ul></div>
          <div className="planpoint-calculator"><div className="calculator-top"><span>CALCULATOR / 01</span><span>ориентир, не оферта</span></div><div className="calculator-total">{formatCurrency(totalEstimate)}</div><div className="calculator-row"><label htmlFor="area">Площадь <output>{area} м²</output></label><input id="area" type="range" min="50" max="250" step="1" value={area} onChange={(event) => setArea(Number(event.target.value))} style={{ "--value": `${((area - 50) / 200) * 100}%` } as React.CSSProperties} /><div className="calculator-range"><span>50 м²</span><span>250 м²</span></div></div><div className="calculator-row material-selector"><label>Материалы <output>{materialMode}</output></label><div className="material-options"><button className={materialMode === "Рациональный" ? "material-option active" : "material-option"} onClick={() => setMaterialMode("Рациональный")}>Рациональный</button><button className={materialMode === "Премиум" ? "material-option active" : "material-option"} onClick={() => setMaterialMode("Премиум")}>Премиум</button></div></div><div className="calculator-breakdown"><span>Работы <b>{formatCurrency(workEstimate)}</b></span><span>Материалы <b>{formatCurrency(materialsEstimate)}</b></span></div><button className="planpoint-button planpoint-button-primary planpoint-full-button" onClick={openLead}>Получить подробный расчёт <ArrowRight size={16} /></button><p>Ориентир обновляется автоматически. Финальная смета — после замера.</p></div>
        </section>

        <section className="planpoint-section planpoint-reviews"><div className="planpoint-section-heading"><div><SectionTag>Что говорят клиенты</SectionTag><h2>Результат,<br /><i>который чувствуется.</i></h2></div><div className="planpoint-rating"><b>4.9</b><span>★★★★★</span><small>средняя оценка по 64 объектам</small></div></div><div className="planpoint-review-grid"><figure className="planpoint-review-card planpoint-review-featured"><blockquote>«Впервые за время ремонта мы понимали, что происходит на объекте. Всё было в одном плане — от розетки до финальной уборки.»</blockquote><figcaption><span>АК</span><div><b>Анна К.</b><small>ЖК Very · 86 м²</small></div></figcaption></figure><figure className="planpoint-review-card"><blockquote>«Смета не менялась каждую неделю, а вопросы решались быстро. Получили ровно тот дом, который обсуждали на первой встрече.»</blockquote><figcaption><span>МЛ</span><div><b>Михаил Л.</b><small>ЖК Ever · 64 м²</small></div></figcaption></figure></div></section>

        <section className="planpoint-section planpoint-faq"><div><SectionTag>Частые вопросы</SectionTag><h2>Планируем<br /><i>заранее.</i></h2><p>Собрали ответы на вопросы, которые обычно появляются до подписания договора.</p></div><div className="planpoint-faq-list">{["Сколько длится ремонт квартиры?", "Когда появляется точная смета?", "Можно ли приехать на объект в работе?", "Что входит в гарантию?"] .map((question, index) => <div className={faqOpen === index ? "planpoint-faq-item open" : "planpoint-faq-item"} key={question}><button onClick={() => setFaqOpen(faqOpen === index ? null : index)} aria-expanded={faqOpen === index}><span>{question}</span><ChevronDown size={19} /></button>{faqOpen === index && <p>{["Средний срок — от четырёх месяцев. Он зависит от площади, состава работ и скорости согласований, поэтому фиксируем календарный план до старта.", "После замера и согласования проектных решений. Предварительный ориентир можно получить уже на первой встрече.", "Да. По предварительной договорённости покажем действующий объект, чтобы вы увидели порядок на площадке и уровень контроля.", "Передаём объект по чек-листу и остаёмся на связи после переезда. Условия и сроки гарантии закрепляем в договоре."][index]}</p>}</div>)}</div></section>

        <section id="contact" className="planpoint-contact"><div className="planpoint-contact-copy"><SectionTag>Следующий шаг</SectionTag><h2>Давайте<br /><i>начнём с плана.</i></h2><p>Расскажите, что хотите изменить. Мы ответим, уточним детали и предложим следующий шаг без давления.</p><div className="planpoint-contact-links"><a href="tel:+79779480672"><Phone size={15} /> 8 (977) 948-06-72</a><a href="https://t.me/Klrem1_bot?start=site" target="_blank" rel="noreferrer">Написать в Telegram <ArrowUpRight size={15} /></a></div></div><div className="planpoint-contact-form-wrap">{contactSent ? <div className="planpoint-inline-success"><div><Check size={22} /></div><h3>Заявка принята.</h3><p>Свяжемся с вами в рабочее время и обсудим проект.</p><button className="planpoint-link-button" onClick={() => setContactSent(false)}>Отправить ещё одну <ArrowRight size={16} /></button></div> : <form onSubmit={submitContactForm} className="planpoint-contact-form"><label>Как к вам обращаться<input value={contactName} onChange={(event) => setContactName(event.target.value)} required placeholder="Ваше имя" /></label><label>Телефон<input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} required placeholder="+7 (___) ___-__-__" /></label><label>Что планируем?<select value={contactService} onChange={(event) => setContactService(event.target.value)}><option>Ремонт квартиры</option><option>Дизайн-проект</option><option>Консультация по смете</option><option>Другое</option></select></label><PersonalDataConsent formId="planpoint-contact" personalDataConsent={contactPersonalDataConsent} telegramConsent={contactTelegramConsent} disabled={submitContactLead.isPending} showValidation={showContactConsentValidation} onConsentInvalid={() => setShowContactConsentValidation(true)} onPersonalDataConsentChange={setContactPersonalDataConsent} onTelegramConsentChange={setContactTelegramConsent} /><button className="planpoint-button planpoint-button-primary planpoint-full-button" type="submit" disabled={submitContactLead.isPending}>{submitContactLead.isPending ? <SendingContent label="Отправляем заявку" /> : <>Отправить запрос <ArrowRight size={16} /></>}</button>{submitContactLead.isError && <p className="planpoint-form-error">Не удалось отправить заявку. Позвоните нам или повторите попытку.</p>}</form>}</div></section>
      </main>

      <footer className="planpoint-footer"><div className="planpoint-footer-top"><a href="#top" className="planpoint-brand"><span className="planpoint-logo"><i /><i /></span><span><b>Классный</b><em>Ремонт</em></span></a><div className="planpoint-footer-links"><a href="#projects">Проекты</a><a href="#process">Процесс</a><a href="#prices">Цены</a><a href="/blog">Блог</a><a href="#contact">Контакты</a></div></div><div className="planpoint-footer-legal"><span>Работаем в Москве и области</span><a href="/privacy-policy">Политика обработки данных</a><a href="/personal-data-consent">Согласие на обработку</a><span>© 2026 Классный Ремонт</span></div></footer>

      <LeadModal open={leadOpen} onClose={() => setLeadOpen(false)} onSuccess={(name) => { setLeadOpen(false); setThankYouName(name); }} calculator={calculator} />
      <ThankYouModal name={thankYouName} onClose={() => setThankYouName(null)} />
    </div>
  );
}

function ArrowDownRightIcon() {
  return <ArrowUpRight size={16} />;
}
