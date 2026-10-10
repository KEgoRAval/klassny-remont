import { useState } from "react";
import { ArrowRight, ArrowUpRight, Check, Clock3, FileText } from "lucide-react";
import { Link, useParams } from "wouter";
import { blogPosts, getBlogPost, getRelatedPosts, type BlogPost } from "@/content/blog";
import { imageSize } from "@/content/media";
import { reachLeadGoal } from "@/lib/metrika";
import { trpc } from "@/lib/trpc";
import { PERSONAL_DATA_CONSENT_VERSION, PersonalDataConsent } from "@/components/PersonalDataConsent";
import { Dot, FaqIcon, ICON_STROKE, SectionLabel, SiteFooter, SiteHeader } from "@/components/KremChrome";
import NotFound from "@/pages/NotFound";

function Breadcrumbs({ items }: { items: Array<{ href?: string; label: string }> }) {
  return (
    <nav className="k-breadcrumbs" aria-label="Хлебные крошки">
      {items.map((item, index) => (
        <span key={item.label}>
          {index > 0 && <span className="k-breadcrumbs-sep" aria-hidden="true">/</span>}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

function PostCard({ post, index }: { post: BlogPost; index: number }) {
  return (
    <article className="k-post">
      <Link href={post.path} className="k-post-photo washed" aria-label={`Открыть статью: ${post.title}`}>
        <img src={post.image} {...imageSize(post.image)} alt={post.imageAlt} loading={index > 1 ? "lazy" : "eager"} decoding="async" />
      </Link>
      <div className="k-post-body">
        <div className="k-post-meta"><span className="tag tag-accent-2">{post.category}</span><time dateTime={post.modifiedAt}>{post.displayDate}</time></div>
        <h3><Link href={post.path}>{post.title}</Link></h3>
        <p>{post.excerpt}</p>
        <Link href={post.path} className="k-post-link">Читать статью <ArrowUpRight size={16} strokeWidth={ICON_STROKE} /></Link>
      </div>
    </article>
  );
}

/** Dark closing panel that sends the reader to the contact form on the home page. */
function BlogCta({ label, title, accent, text, action }: { label: string; title: string; accent: string; text: string; action: string }) {
  return (
    <section className="k-panel k-contacts k-blog-cta">
      <div className="k-panel-inner k-blog-cta-grid">
        <div className="k-stack k-stack-lg">
          <SectionLabel tone="light">{label}</SectionLabel>
          <h2>{title} <span className="k-accent-light">{accent}</span><Dot /></h2>
        </div>
        <div className="k-stack k-stack-lg">
          <p className="k-contacts-text">{text}</p>
          <a href="/#contacts" className="btn btn-primary k-btn-lg">{action}<ArrowRight size={18} strokeWidth={ICON_STROKE} /></a>
        </div>
      </div>
    </section>
  );
}

export function BlogIndex() {
  const featured = blogPosts[0];
  const groups = [
    { title: "Практика ремонта", posts: blogPosts.filter(post => post.category !== "ЖК Москвы" && post.slug !== featured.slug) },
    { title: "Ремонт в жилых комплексах Москвы", posts: blogPosts.filter(post => post.category === "ЖК Москвы") },
  ];

  return (
    <div className="krem-site k-blog" id="top">
      <SiteHeader page="blog" />
      <main>
        <section className="k-container k-page-hero">
          <Breadcrumbs items={[{ href: "/", label: "Главная" }, { label: "Блог" }]} />
          <SectionLabel>Журнал Классного ремонта</SectionLabel>
          <h1>Ремонт — <span className="k-accent">по существу</span><Dot /></h1>
          <p className="k-body-lg">Разбираем стоимость, сроки, приёмку квартиры и подготовку к ремонту в жилых комплексах Москвы. Без обещаний «за месяц» и без скрытых строк в смете.</p>
        </section>

        <section className="k-container k-featured-wrap" aria-label="Главная статья">
          <div className="k-featured">
            <Link href={featured.path} className="k-featured-photo washed"><img src={featured.image} {...imageSize(featured.image)} alt={featured.imageAlt} decoding="async" /></Link>
            <div className="k-featured-copy">
              <span className="tag tag-accent">{featured.category}</span>
              <h2><Link href={featured.path}>{featured.title}</Link></h2>
              <p>{featured.excerpt}</p>
              <div className="k-byline"><span>Классный Ремонт</span><span aria-hidden="true">·</span><time dateTime={featured.modifiedAt}>{featured.displayDate}</time><span aria-hidden="true">·</span><span>{featured.readTime}</span></div>
              <Link href={featured.path} className="btn btn-primary k-btn-lg">Разобраться в смете <ArrowRight size={18} strokeWidth={ICON_STROKE} /></Link>
            </div>
          </div>
        </section>

        {groups.map(group => (
          <section className="k-section k-container" key={group.title}>
            <SectionLabel>Полезное до старта работ</SectionLabel>
            <h2>{group.title}<Dot /></h2>
            <div className="k-post-grid">{group.posts.map((post, index) => <PostCard key={post.slug} post={post} index={index} />)}</div>
          </section>
        ))}

        <BlogCta label="Следующий шаг" title="Покажите квартиру." accent="Смету разберём вместе" text="После разговора и замера подготовим предварительный расчёт, расскажем о точках контроля и покажем, какие решения влияют на срок." action="Получить расчёт за 2 часа" />
      </main>
      <SiteFooter page="blog" />
    </div>
  );
}

function ArticleTable({ table }: { table: NonNullable<BlogPost["sections"][number]["table"]> }) {
  return <div className="k-table-scroll"><table className="k-table"><thead><tr>{table.headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{table.rows.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.map(cell => <td key={cell}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

const formatRubles = (value: number) => `${value.toLocaleString("ru-RU")} ₽`;

function ComplexEstimateForm({ complexName }: { complexName: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState(90);
  const [submitted, setSubmitted] = useState(false);
  const [personalDataConsent, setPersonalDataConsent] = useState(false);
  const [telegramConsent, setTelegramConsent] = useState(false);
  const [showConsentValidation, setShowConsentValidation] = useState(false);
  // The cost of work only; materials go into the estimate as a separate line after the visit.
  const workEstimate = area * 40_000;
  const formId = `complex-estimate-${complexName.replaceAll(" ", "-").replaceAll("«", "").replaceAll("»", "")}`;
  const submitLead = trpc.leads.submit.useMutation({
    onSuccess: () => {
      reachLeadGoal("lead_blog");
      setSubmitted(true);
      setPhone("");
      setPersonalDataConsent(false);
      setTelegramConsent(false);
      setShowConsentValidation(false);
    },
  });

  return (
    <section className="k-panel k-contacts k-estimate" aria-labelledby="complex-estimate-title" data-complex={complexName}>
      <div className="k-estimate-grid">
        <div className="k-stack k-stack-lg">
          <SectionLabel tone="light">Расчёт по вашему объекту</SectionLabel>
          <h2 id="complex-estimate-title">Рассчитать стоимость <span className="k-accent-light">ремонта в моём ЖК</span><Dot /></h2>
          <p className="k-contacts-text">Название комплекса уже подставлено: <b>{complexName}</b>. Оставьте контакты — подготовим предварительный расчёт за 2 часа.</p>
        </div>
        <div className="k-form-card">
          {submitted ? (
            <div className="k-estimate-success" aria-live="polite">
              <span className="k-thankyou-check" aria-hidden="true"><Check size={30} strokeWidth={ICON_STROKE} /></span>
              <SectionLabel>Заявка отправлена</SectionLabel>
              <h3>Спасибо, {name}.</h3>
              <p>Параметры для {complexName} уже переданы команде. Свяжемся в течение 2 часов, уточним задачу и договоримся о замере.</p>
              <button type="button" className="btn btn-secondary k-btn-md" onClick={() => { setSubmitted(false); setName(""); setArea(90); }}>Рассчитать другую квартиру <ArrowRight size={16} strokeWidth={ICON_STROKE} /></button>
            </div>
          ) : (
            <form className="k-form" onSubmit={(event) => { event.preventDefault(); if (!personalDataConsent || !telegramConsent) { setShowConsentValidation(true); return; } submitLead.mutate({ name, phone, service: `Расчёт ремонта в ${complexName}`, area, materialLabel: "Рациональный", workEstimate, source: "calculator", personalDataConsent, telegramConsent, consentVersion: PERSONAL_DATA_CONSENT_VERSION, policyVersion: PERSONAL_DATA_CONSENT_VERSION }); }}>
              <div className="k-estimate-complex"><span>Ваш жилой комплекс</span><b>{complexName}</b></div>
              <div className="k-calc-range">
                <div className="k-calc-row"><label htmlFor={`${formId}-area`}>Площадь квартиры</label><output htmlFor={`${formId}-area`}>{area} м²</output></div>
                <input id={`${formId}-area`} type="range" min="50" max="250" step="5" value={area} onChange={(event) => setArea(Number(event.target.value))} disabled={submitLead.isPending} />
                <div className="k-calc-limits"><span>50 м²</span><span>250 м²</span></div>
              </div>
              <div className="k-calc-note"><div><span>Ориентир по работам</span><b>от {formatRubles(workEstimate)}</b></div><small>Материалы и индивидуальные решения — отдельной строкой после замера.</small></div>
              <div className="field"><label htmlFor={`${formId}-name`}>Ваше имя</label><input className="ym-record-keys" value={name} id={`${formId}-name`} onChange={(event) => setName(event.target.value)} disabled={submitLead.isPending} required minLength={2} placeholder="Как к вам обращаться" /></div>
              <div className="field"><label htmlFor={`${formId}-phone`}>Телефон</label><input className="ym-record-keys" value={phone} id={`${formId}-phone`} type="tel" onChange={(event) => setPhone(event.target.value)} disabled={submitLead.isPending} required minLength={6} placeholder="+7 (___) ___‑__‑__" /></div>
              <PersonalDataConsent formId={formId} personalDataConsent={personalDataConsent} telegramConsent={telegramConsent} disabled={submitLead.isPending} showValidation={showConsentValidation} onConsentInvalid={() => setShowConsentValidation(true)} onPersonalDataConsentChange={setPersonalDataConsent} onTelegramConsentChange={setTelegramConsent} />
              <button className={submitLead.isPending ? "btn btn-primary k-btn-lg k-btn-block form-submit-loading" : "btn btn-primary k-btn-lg k-btn-block"} type="submit" disabled={submitLead.isPending}>{submitLead.isPending ? <><span className="button-loader" aria-hidden="true"><i></i><i></i><i></i></span>Отправляем заявку</> : <>Получить расчёт за 2 часа <ArrowRight size={17} strokeWidth={ICON_STROKE} /></>}</button>
              {submitLead.isError && <p className="form-error">Не удалось отправить заявку. Позвоните нам или повторите попытку.</p>}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

export function BlogArticle() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getBlogPost(slug) : undefined;

  if (!post) return <NotFound />;
  const related = getRelatedPosts(post.slug);
  const complexName = post.residentialComplex ?? post.shortTitle.replace(/^Ремонт в /, "");
  return (
    <div className="krem-site k-blog k-article-page" id="top">
      <SiteHeader page="blog" />
      <main>
        <article>
          <header className="k-container k-article-hero">
            <div className="k-article-head">
              <Breadcrumbs items={[{ href: "/", label: "Главная" }, { href: "/blog", label: "Блог" }, { label: post.shortTitle }]} />
              <div className="k-article-meta"><span className="tag tag-accent-2">{post.category}</span><time dateTime={post.modifiedAt}>Обновлено {post.displayDate}</time><span><Clock3 size={14} strokeWidth={ICON_STROKE} />{post.readTime}</span></div>
              <h1>{post.title}</h1>
              <p className="k-body-lg">{post.description}</p>
              <div className="k-article-author"><span className="k-article-author-mark" aria-hidden="true">K</span><span><b>Редакция «Классного ремонта»</b><small>Практика ремонта квартир в Москве</small></span></div>
            </div>
            <div className="k-article-cover washed"><img src={post.image} {...imageSize(post.image)} alt={post.imageAlt} fetchPriority="high" decoding="async" /></div>
          </header>

          <div className="k-container k-article-layout">
            <aside className="k-article-toc"><p>В статье</p><ol>{post.sections.map((section, index) => <li key={section.heading}><a href={`#section-${index + 1}`}>{section.heading}</a></li>)}</ol><a href="/#contacts" className="btn btn-primary k-btn-sm">Обсудить проект <ArrowRight size={15} strokeWidth={ICON_STROKE} /></a></aside>
            <div className="k-article-content">
              <div className="k-article-answer"><SectionLabel tone="sage">Короткий ответ</SectionLabel><p>{post.directAnswer}</p></div>
              {post.sections.map((section, index) => <section className="k-article-section" id={`section-${index + 1}`} key={section.heading}><h2>{section.heading}</h2>{section.paragraphs?.map(paragraph => <p key={paragraph}>{paragraph}</p>)}{section.bullets && <ul>{section.bullets.map(bullet => <li key={bullet}>{bullet}</li>)}</ul>}{section.table && <ArticleTable table={section.table} />}</section>)}

              <section className="k-article-faq" aria-labelledby="article-faq-title"><SectionLabel>Частые вопросы</SectionLabel><h2 id="article-faq-title">Что ещё важно уточнить<Dot /></h2><div className="k-faq-list">{post.faqs.map((faq, index) => <details name="article-faq" open={index === 0} key={faq.question}><summary>{faq.question}<FaqIcon /></summary><p>{faq.answer}</p></details>)}</div></section>
              <section className="k-article-sources"><span className="k-article-sources-icon" aria-hidden="true"><FileText size={20} strokeWidth={ICON_STROKE} /></span><div><h2>Источники и документы</h2><p>Ссылки приведены для самостоятельной проверки. Условия конкретного объекта всегда уточняются по актуальным документам.</p><ul>{post.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.label}<ArrowUpRight size={14} strokeWidth={ICON_STROKE} /></a></li>)}</ul></div></section>
              {post.disclaimer && <p className="k-article-disclaimer">{post.disclaimer}</p>}
            </div>
          </div>
          {post.category === "ЖК Москвы" && <ComplexEstimateForm complexName={complexName} />}
        </article>

        <section className="k-section k-container">
          <div className="k-heading-row"><div><SectionLabel>Продолжить чтение</SectionLabel><h2>Полезно до <span className="k-accent">старта работ</span><Dot /></h2></div><Link href="/blog" className="btn btn-secondary k-btn-md">Все статьи <ArrowRight size={16} strokeWidth={ICON_STROKE} /></Link></div>
          <div className="k-post-grid k-post-grid-related">{related.map((item, index) => <PostCard key={item.slug} post={item} index={index} />)}</div>
        </section>
        <BlogCta label="Нужен план для вашей квартиры?" title="От расчёта —" accent="к понятному проекту" text="Разберём исходные данные, назначим замер и подготовим предварительный расчёт в течение 2 часов." action="Оставить заявку на замер" />
      </main>
      <SiteFooter page="blog" />
    </div>
  );
}
