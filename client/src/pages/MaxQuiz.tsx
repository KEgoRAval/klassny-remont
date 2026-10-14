import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Calculator, Check, FileText, Paperclip, Phone, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { reachLeadGoal } from "@/lib/metrika";
import { PERSONAL_DATA_CONSENT_VERSION, PersonalDataConsent } from "@/components/PersonalDataConsent";
import { Dot, ICON_STROKE, KremLogo, SectionLabel } from "@/components/KremChrome";
import { DESIGN_FILE_ACCEPT, DESIGN_FILE_SERVER_MESSAGES, designFileProblem, formatFileSize, readFileAsBase64 } from "@/lib/designFile";
import {
  DESIGN_STATUSES,
  MAX_AREA,
  PROPERTY_TYPES,
  clampArea,
  designStatusLabel,
  WORK_RATE_FROM,
  estimateFrom,
  propertyType,
  type DesignStatusId,
  type PropertyTypeId,
} from "@/content/maxQuiz";

/**
 * Landing page for the MAX messenger mini-app: one action, two branches.
 * "Project" sends a design project for a full estimate; "quiz" asks three questions and
 * shows the "from" price for the area before asking for a phone number.
 */
type Step = "start" | "area" | "type" | "design" | "result" | "project" | "done";

const QUIZ_STEPS: Step[] = ["area", "type", "design", "result"];
const rub = (value: number) => `${value.toLocaleString("ru-RU")} ₽`;

function Progress({ step }: { step: Step }) {
  const index = QUIZ_STEPS.indexOf(step);
  if (index < 0) return null;
  return (
    <div className="mx-progress" aria-label={`Шаг ${index + 1} из ${QUIZ_STEPS.length}`}>
      {QUIZ_STEPS.map((item, i) => <span key={item} className={i <= index ? "is-on" : undefined} />)}
    </div>
  );
}

function AreaField({ area, onChange }: { area: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(area));
  const commit = (value: number) => {
    const next = clampArea(value);
    onChange(next);
    setDraft(String(next));
  };
  return (
    <div className="k-calc-range">
      <div className="k-calc-row">
        <label htmlFor="mx-area">Площадь квартиры, м²</label>
        <input
          className="mx-area-input"
          inputMode="numeric"
          aria-label="Площадь в квадратных метрах"
          value={draft}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
            setDraft(digits);
            if (digits) onChange(clampArea(Number(digits)));
          }}
          onBlur={() => commit(Number(draft || area))}
        />
      </div>
      <input id="mx-area" type="range" min={MAX_AREA.min} max={MAX_AREA.max} step={MAX_AREA.step} value={area} onChange={(e) => commit(Number(e.target.value))} />
      <div className="k-calc-limits"><span>{MAX_AREA.min} м²</span><span>{MAX_AREA.max} м²</span></div>
    </div>
  );
}

/**
 * Launch data MAX passes to a mini-app: window.WebApp.initData, also the WebAppData
 * parameter of the URL fragment. Absent when the page is opened in a browser.
 */
function readMaxInitData(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const bridge = (window as unknown as { WebApp?: { initData?: string } }).WebApp?.initData;
  if (bridge) return bridge;
  try {
    return new URLSearchParams(window.location.hash.replace(/^#/, "")).get("WebAppData") || undefined;
  } catch {
    return undefined;
  }
}

function SendingContent({ label }: { label: string }) {
  return <><span className="button-loader" aria-hidden="true"><i></i><i></i><i></i></span><span>{label}</span></>;
}

export default function MaxQuiz() {
  const [step, setStep] = useState<Step>("start");
  const [area, setArea] = useState<number>(MAX_AREA.initial);
  const [typeId, setTypeId] = useState<PropertyTypeId | null>(null);
  const [designId, setDesignId] = useState<DesignStatusId | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [showConsentError, setShowConsentError] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [fileReading, setFileReading] = useState(false);
  const [doneBranch, setDoneBranch] = useState<"project" | "quiz">("quiz");
  const [email, setEmail] = useState("");
  // Read after hydration (the server render has no window); the server decides whether it is genuine.
  const [maxInitData, setMaxInitData] = useState<string | undefined>(undefined);
  useEffect(() => setMaxInitData(readMaxInitData()), []);
  const insideMax = Boolean(maxInitData);

  const workFrom = estimateFrom(area);
  const submit = trpc.leads.submit.useMutation({
    onSuccess: () => {
      reachLeadGoal("lead_max");
      setStep("done");
    },
  });
  const sending = fileReading || submit.isPending;

  const go = (next: Step) => {
    setStep(next);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  const chooseFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (!chosen) return;
    const problem = designFileProblem(chosen);
    setFileError(problem ?? "");
    setFile(problem ? null : chosen);
  };

  const send = async (branch: "project" | "quiz") => {
    if (!consent) {
      setShowConsentError(true);
      return;
    }
    let attachment: { fileName: string; data: string } | undefined;
    if (branch === "project") {
      if (!file) {
        setFileError("Приложите дизайн-проект в PDF или картинкой.");
        return;
      }
      setFileReading(true);
      try {
        attachment = { fileName: file.name, data: await readFileAsBase64(file) };
      } catch {
        setFileError("Не удалось прочитать файл. Выберите его ещё раз.");
        return;
      } finally {
        setFileReading(false);
      }
    }
    const type = typeId ? propertyType(typeId) : null;
    const details = branch === "project"
      ? "Смета по дизайн-проекту"
      : `Предварительный расчёт · проект: ${designStatusLabel(designId ?? "none").toLowerCase()}`;
    setDoneBranch(branch);
    submit.mutate({
      name,
      phone,
      service: `MAX: ${details}`.slice(0, 120),
      area,
      materialLabel: type?.label ?? "Не указан",
      workEstimate: workFrom,
      source: branch === "project" ? "contact" : "calculator",
      channel: "max",
      personalDataConsent: true,
      telegramConsent: true,
      consentVersion: PERSONAL_DATA_CONSENT_VERSION,
      policyVersion: PERSONAL_DATA_CONSENT_VERSION,
      attachment,
      maxInitData: branch === "project" ? maxInitData : undefined,
      email: branch === "project" && !insideMax ? email : undefined,
    });
  };

  const contactFields = (formId: string) => (
    <>
      <div className="field"><label htmlFor={`${formId}-name`}>Как к вам обращаться</label><input className="ym-record-keys" id={`${formId}-name`} value={name} onChange={(e) => setName(e.target.value)} disabled={sending} required minLength={2} autoComplete="name" placeholder="Ваше имя" /></div>
      <div className="field"><label htmlFor={`${formId}-phone`}>Телефон</label><input className="ym-record-keys" id={`${formId}-phone`} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={sending} required minLength={6} autoComplete="tel" placeholder="+7 (___) ___-__-__" /></div>
      <PersonalDataConsent formId={formId} personalDataConsent={consent} telegramConsent={consent} disabled={sending} showValidation={showConsentError} onConsentInvalid={() => setShowConsentError(true)} onPersonalDataConsentChange={setConsent} onTelegramConsentChange={setConsent} />
      {submit.isError && <p className="form-error" role="alert">{DESIGN_FILE_SERVER_MESSAGES.includes(submit.error.message) ? submit.error.message : "Не удалось отправить заявку. Позвоните нам или повторите попытку."}</p>}
    </>
  );

  const back = (to: Step) => (
    <button type="button" className="btn btn-ghost mx-back" onClick={() => go(to)} disabled={sending}><ArrowLeft size={18} strokeWidth={ICON_STROKE} />Назад</button>
  );

  return (
    <div className="krem-site mx-page">
      <header className="mx-top">
        <a href="/" aria-label="Классный ремонт — сайт"><KremLogo /></a>
        <a className="mx-call" href="tel:+79779480672" aria-label="Позвонить"><Phone size={18} strokeWidth={ICON_STROKE} /></a>
      </header>

      <main className="mx-main">
        <Progress step={step} />

        {step === "start" && (
          <section className="mx-screen">
            <SectionLabel>Ремонт под ключ в Москве</SectionLabel>
            <h1>Посчитаем ваш ремонт<Dot /></h1>
            <p className="mx-lead">Пришлите дизайн-проект — сделаем смету за 2 часа в рабочее время, бесплатно. Нет проекта — ответьте на 3 вопроса и сразу увидите ориентир по стоимости работ.</p>
            <div className="mx-choices">
              <button type="button" className="mx-choice mx-choice-main" onClick={() => go("project")}>
                <span className="mx-choice-icon"><FileText size={22} strokeWidth={ICON_STROKE} /></span>
                <span><b>Есть дизайн-проект</b><small>Смета за 2 часа</small></span>
                <ArrowRight size={20} strokeWidth={ICON_STROKE} />
              </button>
              <button type="button" className="mx-choice" onClick={() => go("area")}>
                <span className="mx-choice-icon"><Calculator size={22} strokeWidth={ICON_STROKE} /></span>
                <span><b>Предварительный расчёт</b><small>3 вопроса, меньше минуты</small></span>
                <ArrowRight size={20} strokeWidth={ICON_STROKE} />
              </button>
            </div>
            <p className="mx-footnote">Работы — от 40 000 ₽/м². Материалы, мебель и декор — отдельными строками сметы.</p>
          </section>
        )}

        {step === "area" && (
          <section className="mx-screen">
            <SectionLabel>Вопрос 1 из 3</SectionLabel>
            <h2>Какая площадь квартиры?</h2>
            <div className="card mx-card"><AreaField area={area} onChange={setArea} /></div>
            <div className="mx-nav">{back("start")}<button type="button" className="btn btn-primary k-btn-lg" onClick={() => go("type")}>Дальше<ArrowRight size={18} strokeWidth={ICON_STROKE} /></button></div>
          </section>
        )}

        {step === "type" && (
          <section className="mx-screen">
            <SectionLabel>Вопрос 2 из 3</SectionLabel>
            <h2>Что за квартира?</h2>
            <div className="mx-options" role="radiogroup" aria-label="Тип квартиры">
              {PROPERTY_TYPES.map(type => (
                <button type="button" role="radio" aria-checked={typeId === type.id} key={type.id} className={typeId === type.id ? "mx-option is-on" : "mx-option"} onClick={() => { setTypeId(type.id); go("design"); }}>
                  <b>{type.label}</b><small>{type.hint}</small>
                </button>
              ))}
            </div>
            <div className="mx-nav">{back("area")}</div>
          </section>
        )}

        {step === "design" && (
          <section className="mx-screen">
            <SectionLabel>Вопрос 3 из 3</SectionLabel>
            <h2>Есть дизайн-проект?</h2>
            <div className="mx-options" role="radiogroup" aria-label="Дизайн-проект">
              {DESIGN_STATUSES.map(status => (
                <button type="button" role="radio" aria-checked={designId === status.id} key={status.id} className={designId === status.id ? "mx-option is-on" : "mx-option"} onClick={() => { setDesignId(status.id); go(status.id === "ready" ? "project" : "result"); }}>
                  <b>{status.label}</b>{status.id === "ready" && <small>Посчитаем точную смету по проекту за 2 часа</small>}
                </button>
              ))}
            </div>
            <div className="mx-nav">{back("type")}</div>
          </section>
        )}

        {step === "result" && (
          <section className="mx-screen">
            <SectionLabel tone="sage">Предварительный расчёт</SectionLabel>
            <div className="card elev-md mx-result">
              <span className="mx-result-label">Стоимость работ, {area} м² · {propertyType(typeId ?? "new-bare").label.toLowerCase()}</span>
              <output className="mx-result-sum" aria-live="polite">от {rub(workFrom)}</output>
              <small>Работы — от {rub(WORK_RATE_FROM)}/м², без материалов, мебели и декора. Точную сумму зафиксируем в смете после замера{designId === "in-progress" ? " или по готовому проекту" : ""}.</small>
            </div>
            <form className="k-form mx-form" onSubmit={(e) => { e.preventDefault(); void send("quiz"); }}>
              <h3>Получить точный расчёт</h3>
              <p className="mx-form-copy">Перезвоним в течение 2 рабочих часов, уточним планировку и назовём сумму без «от».</p>
              {contactFields("mx-quiz")}
              <button type="submit" disabled={sending} className={sending ? "btn btn-primary k-btn-lg k-btn-block form-submit-loading" : "btn btn-primary k-btn-lg k-btn-block"}>{sending ? <SendingContent label="Отправляем" /> : <>Получить расчёт<ArrowRight size={18} strokeWidth={ICON_STROKE} /></>}</button>
            </form>
            <div className="mx-nav">{back("design")}</div>
          </section>
        )}

        {step === "project" && (
          <section className="mx-screen">
            <SectionLabel>Смета по дизайн-проекту</SectionLabel>
            <h2>Пришлите проект — смета за 2 часа<Dot /></h2>
            <p className="mx-lead">Считаем по нашему прайсу построчно, бесплатно. Готовую смету в PDF пришлём {insideMax ? "в чат с ботом" : "на почту"}.</p>
            <form className="k-form mx-form" onSubmit={(e) => { e.preventDefault(); void send("project"); }}>
              <div className="k-file-field">
                <label className={file ? "k-file k-file-chosen" : "k-file"} htmlFor="mx-file">
                  <input id="mx-file" type="file" accept={DESIGN_FILE_ACCEPT} onChange={chooseFile} disabled={sending} aria-describedby={fileError ? "mx-file-error" : undefined} />
                  <span className="k-file-icon"><Paperclip size={16} strokeWidth={ICON_STROKE} /></span>
                  {file ? <span className="k-file-name">{file.name} <span className="k-muted">· {formatFileSize(file.size)}</span></span> : <span>Прикрепить дизайн-проект <span className="k-muted">· PDF или фото, до 20 МБ</span></span>}
                </label>
                {file && <button type="button" className="k-file-remove" onClick={() => setFile(null)} disabled={sending} aria-label="Убрать файл"><X size={16} strokeWidth={ICON_STROKE} /></button>}
                {fileError ? <p className="form-error" id="mx-file-error" role="alert">{fileError}</p> : <small className="k-file-hint">Файл увидит только команда «Классного ремонта». Не прикладывайте паспортные данные и другие документы, не нужные для расчёта.</small>}
              </div>
              <AreaField area={area} onChange={setArea} />
              {!insideMax && <div className="field"><label htmlFor="mx-project-email">Email — пришлём смету сюда</label><input className="ym-record-keys" id="mx-project-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={sending} required autoComplete="email" placeholder="name@mail.ru" /></div>}
              {contactFields("mx-project")}
              <button type="submit" disabled={sending} className={sending ? "btn btn-primary k-btn-lg k-btn-block form-submit-loading" : "btn btn-primary k-btn-lg k-btn-block"}>{sending ? <SendingContent label={fileReading ? "Загружаем файл" : "Отправляем"} /> : <>Отправить проект<ArrowRight size={18} strokeWidth={ICON_STROKE} /></>}</button>
            </form>
            <div className="mx-nav">{back(designId === "ready" ? "design" : "start")}</div>
          </section>
        )}

        {step === "done" && (
          <section className="mx-screen mx-done">
            <span className="k-thankyou-check" aria-hidden="true"><Check size={30} strokeWidth={ICON_STROKE} /></span>
            <h2>Спасибо{name ? `, ${name}` : ""}!</h2>
            <p className="mx-lead">{doneBranch === "project" ? `Проект получили. Смета придёт ${insideMax ? "в этот чат" : "на почту"} в течение двух часов — позвоним, если появятся вопросы по проекту.` : "Заявка у нас. Перезвоним в течение 2 рабочих часов и назовём точную сумму."}</p>
            <a className="btn btn-secondary k-btn-md" href="/">Посмотреть наши проекты</a>
          </section>
        )}
      </main>
    </div>
  );
}
