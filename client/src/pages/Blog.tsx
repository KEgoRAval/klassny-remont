import { useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Clock3, FileText, Phone } from "lucide-react";
import { Link, useParams } from "wouter";
import { blogPosts, getBlogPost, getRelatedPosts, type BlogPost } from "@/content/blog";
import { trpc } from "@/lib/trpc";
import { PERSONAL_DATA_CONSENT_VERSION, PersonalDataConsent } from "@/components/PersonalDataConsent";
import NotFound from "@/pages/NotFound";

function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className={dark ? "blog-brand blog-brand-dark" : "blog-brand"} aria-label="Классный Ремонт — главная">
      <span className="blog-brand-mark">КР</span>
      <span><b>Классный</b><em>Ремонт</em></span>
    </Link>
  );
}

function BlogHeader() {
  return (
    <header className="blog-header">
      <div className="blog-header-inner">
        <Brand dark />
        <nav className="blog-nav" aria-label="Основная навигация">
          <Link href="/">Главная</Link>
          <Link href="/blog" aria-current="page">Блог</Link>
          <a href="/#projects">Проекты</a>
          <a href="/#contacts">Контакты</a>
        </nav>
        <a className="blog-phone" href="tel:+79779480672"><Phone size={15} />8 (977) 948‑06‑72</a>
      </div>
    </header>
  );
}

function BlogFooter() {
  return (
    <footer className="blog-footer">
      <div><Brand /><p>Ремонт квартир бизнес- и премиум‑класса в Москве. Смета, график и контроль — до старта работ.</p></div>
      <div className="blog-footer-links"><Link href="/blog">Все статьи</Link><a href="/#prices">Расчёт стоимости</a><a href="/#contacts">Оставить заявку</a></div>
      <div className="blog-footer-legal"><b>ИП Бережной Егор Юрьевич</b><span>ОГРНИП 321527500117786 · ИНН 773166101203</span><Link href="/privacy-policy">Политика обработки данных</Link><Link href="/personal-data-consent">Согласие на обработку</Link></div>
    </footer>
  );
}

function PostCard({ post, index }: { post: BlogPost; index: number }) {
  return (
    <article className={`blog-card blog-card-${(index % 3) + 1}`}>
      <Link href={post.path} className="blog-card-image" aria-label={`Открыть статью: ${post.title}`}>
        <img src={post.image} alt={post.imageAlt} loading={index > 1 ? "lazy" : "eager"} />
      </Link>
      <div className="blog-card-body">
        <div className="blog-card-meta"><span>{post.category}</span><time dateTime={post.modifiedAt}>{post.displayDate}</time></div>
        <h2><Link href={post.path}>{post.title}</Link></h2>
        <p>{post.excerpt}</p>
        <Link href={post.path} className="blog-card-link">Читать статью <ArrowUpRight size={16} /></Link>
      </div>
    </article>
  );
}

export function BlogIndex() {
  const featured = blogPosts[0];
  const groups = [
    { title: "Практика ремонта", posts: blogPosts.filter(post => post.category !== "ЖК Москвы" && post.slug !== featured.slug) },
    { title: "Ремонт в жилых комплексах Москвы", posts: blogPosts.filter(post => post.category === "ЖК Москвы") },
  ];

  return (
    <div className="blog-page">
      <BlogHeader />
      <main>
        <section className="blog-hero">
          <div className="blog-breadcrumb"><Link href="/">Главная</Link><span>/</span><span>Блог</span></div>
          <p className="blog-kicker">Журнал Классного Ремонта</p>
          <h1>Ремонт —<br /><i>по существу.</i></h1>
          <p className="blog-hero-copy">Разбираем стоимость, сроки, приёмку квартиры и подготовку к ремонту в жилых комплексах Москвы. Без обещаний «за месяц» и без скрытых строк в смете.</p>
        </section>

        <section className="blog-featured" aria-label="Главная статья">
          <Link href={featured.path} className="blog-featured-image"><img src={featured.image} alt={featured.imageAlt} /></Link>
          <div className="blog-featured-copy"><p className="blog-kicker">{featured.category}</p><h2>{featured.title}</h2><p>{featured.excerpt}</p><div className="blog-byline"><span>Классный Ремонт</span><span>·</span><time dateTime={featured.modifiedAt}>{featured.displayDate}</time><span>·</span><span>{featured.readTime}</span></div><Link href={featured.path} className="blog-button">Разобраться в смете <ArrowRight size={18} /></Link></div>
        </section>

        {groups.map(group => (
          <section className="blog-section" key={group.title}>
            <div className="blog-section-heading"><p className="blog-kicker">Полезное до старта работ</p><h2>{group.title}</h2></div>
            <div className="blog-grid">{group.posts.map((post, index) => <PostCard key={post.slug} post={post} index={index} />)}</div>
          </section>
        ))}

        <section className="blog-cta"><p className="blog-kicker">Следующий шаг</p><h2>Покажите квартиру.<br /><i>Смету разберём вместе.</i></h2><p>После разговора и замера подготовим предварительный расчёт, расскажем о точках контроля и покажем, какие решения влияют на срок.</p><a href="/#contacts" className="blog-button">Получить расчёт за 24 часа <ArrowRight size={18} /></a></section>
      </main>
      <BlogFooter />
    </div>
  );
}

function ArticleTable({ table }: { table: NonNullable<BlogPost["sections"][number]["table"]> }) {
  return <div className="article-table-scroll"><table className="article-table"><thead><tr>{table.headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{table.rows.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.map(cell => <td key={cell}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

const formatRubles = (value: number) => `${value.toLocaleString("ru-RU")} ₽`;

function ComplexEstimateForm({ complexName }: { complexName: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState(90);
  const [submitted, setSubmitted] = useState(false);
  const [personalDataConsent, setPersonalDataConsent] = useState(false);
  const [telegramConsent, setTelegramConsent] = useState(false);
  const workEstimate = area * 40_000;
  const materialsEstimate = Math.round(workEstimate * 0.55);
  const totalEstimate = workEstimate + materialsEstimate;
  const submitLead = trpc.leads.submit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setPhone("");
      setPersonalDataConsent(false);
      setTelegramConsent(false);
    },
  });

  if (submitted) {
    return <section className="complex-estimate complex-estimate-success" aria-live="polite"><span className="complex-success-mark"><Check size={22} /></span><div><p className="blog-kicker">Заявка отправлена</p><h2>Спасибо, {name}.</h2><p>Параметры для {complexName} уже переданы команде. Свяжемся в течение 24 часов, уточним задачу и договоримся о замере.</p><button type="button" onClick={() => { setSubmitted(false); setName(""); setArea(90); }}>Рассчитать другую квартиру <ArrowRight size={16} /></button></div></section>;
  }

  return (
    <section className="complex-estimate" aria-labelledby="complex-estimate-title" data-complex={complexName}>
      <div className="complex-estimate-intro"><p className="blog-kicker">Расчёт по вашему объекту</p><h2 id="complex-estimate-title">Рассчитать стоимость<br /><i>ремонта в моём ЖК.</i></h2><p>Название комплекса уже подставлено: <b>{complexName}</b>. Оставьте контакты — подготовим предварительный расчёт за 24 часа.</p></div>
      <form className="complex-estimate-form" onSubmit={(event) => { event.preventDefault(); if (!personalDataConsent || !telegramConsent) return; submitLead.mutate({ name, phone, service: `Расчёт ремонта в ${complexName}`, area, materialLabel: "Рациональный", workEstimate, materialsEstimate, totalEstimate, source: "calculator", personalDataConsent, telegramConsent, consentVersion: PERSONAL_DATA_CONSENT_VERSION, policyVersion: PERSONAL_DATA_CONSENT_VERSION }); }}>
        <div className="complex-name"><span>Ваш жилой комплекс</span><b>{complexName}</b></div>
        <label className="complex-range-label">Площадь квартиры <output>{area} м²</output><input type="range" min="50" max="250" step="5" value={area} onChange={(event) => setArea(Number(event.target.value))} style={{ "--value": `${((area - 50) / 200) * 100}%` } as React.CSSProperties} disabled={submitLead.isPending} /><small>50 м² <span>250 м²</span></small></label>
        <div className="complex-estimate-price"><span>Ориентир по работам</span><b>от {formatRubles(workEstimate)}</b><small>Материалы и индивидуальные решения — отдельной строкой после замера.</small></div>
        <div className="complex-fields"><label>Ваше имя<input value={name} onChange={(event) => setName(event.target.value)} disabled={submitLead.isPending} required minLength={2} placeholder="Как к вам обращаться" /></label><label>Телефон<input value={phone} onChange={(event) => setPhone(event.target.value)} disabled={submitLead.isPending} required minLength={6} placeholder="+7 (___) ___‑__‑__" /></label></div>
        <PersonalDataConsent formId={`complex-estimate-${complexName.replaceAll(" ", "-").replaceAll("«", "").replaceAll("»", "")}`} personalDataConsent={personalDataConsent} telegramConsent={telegramConsent} disabled={submitLead.isPending} onPersonalDataConsentChange={setPersonalDataConsent} onTelegramConsentChange={setTelegramConsent} />
        <button className={submitLead.isPending ? "blog-button complex-submit form-submit-loading" : "blog-button complex-submit"} type="submit" disabled={submitLead.isPending}>{submitLead.isPending ? <><span className="button-loader" aria-hidden="true"><i></i><i></i><i></i></span>Отправляем заявку</> : <>Получить расчёт за 24 часа <ArrowRight size={17} /></>}</button>
        {submitLead.isError && <p className="complex-form-error">Не удалось отправить заявку. Позвоните нам или повторите попытку.</p>}
      </form>
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
    <div className="blog-page article-page">
      <BlogHeader />
      <main>
        <article>
          <header className="article-hero">
            <div className="article-shell">
              <div className="blog-breadcrumb"><Link href="/">Главная</Link><span>/</span><Link href="/blog">Блог</Link><span>/</span><span>{post.shortTitle}</span></div>
              <div className="article-meta"><span>{post.category}</span><span>·</span><time dateTime={post.modifiedAt}>Обновлено {post.displayDate}</time><span>·</span><span><Clock3 size={13} />{post.readTime}</span></div>
              <h1>{post.title}</h1>
              <p className="article-lead">{post.description}</p>
              <div className="article-author"><span className="article-author-mark">КР</span><span><b>Редакция «Классного Ремонта»</b><small>Практика ремонта квартир в Москве</small></span></div>
            </div>
            <div className="article-cover"><img src={post.image} alt={post.imageAlt} /></div>
          </header>

          <div className="article-shell article-content-wrap">
            <aside className="article-aside"><p>В статье</p><ol>{post.sections.map((section, index) => <li key={section.heading}><a href={`#section-${index + 1}`}>{section.heading}</a></li>)}</ol><a href="/#contacts" className="article-aside-cta">Обсудить проект <ArrowRight size={15} /></a></aside>
            <div className="article-content">
              <div className="article-answer"><p className="article-answer-label">Короткий ответ</p><p>{post.directAnswer}</p></div>
              {post.sections.map((section, index) => <section className="article-section" id={`section-${index + 1}`} key={section.heading}><h2>{section.heading}</h2>{section.paragraphs?.map(paragraph => <p key={paragraph}>{paragraph}</p>)}{section.bullets && <ul>{section.bullets.map(bullet => <li key={bullet}>{bullet}</li>)}</ul>}{section.table && <ArticleTable table={section.table} />}</section>)}

              <section className="article-faq" aria-labelledby="article-faq-title"><p className="blog-kicker">Частые вопросы</p><h2 id="article-faq-title">Что ещё важно уточнить</h2>{post.faqs.map((faq, index) => <details open={index === 0} key={faq.question}><summary>{faq.question}<ArrowRight size={18} /></summary><p>{faq.answer}</p></details>)}</section>
              <section className="article-sources"><FileText size={20} /><div><h2>Источники и документы</h2><p>Ссылки приведены для самостоятельной проверки. Условия конкретного объекта всегда уточняются по актуальным документам.</p><ul>{post.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.label}<ArrowUpRight size={14} /></a></li>)}</ul></div></section>
              {post.disclaimer && <p className="article-disclaimer">{post.disclaimer}</p>}
              {post.category === "ЖК Москвы" && <ComplexEstimateForm complexName={complexName} />}
            </div>
          </div>
        </article>

        <section className="related-posts"><div className="related-heading"><p className="blog-kicker">Продолжить чтение</p><h2>Полезно до<br /><i>старта работ.</i></h2><Link href="/blog">Все статьи <ArrowRight size={16} /></Link></div><div className="related-grid">{related.map((item, index) => <PostCard key={item.slug} post={item} index={index} />)}</div></section>
        <section className="article-cta"><div><p className="blog-kicker">Нужен план для вашей квартиры?</p><h2>От расчёта —<br /><i>к понятному проекту.</i></h2></div><div><p>Разберём исходные данные, назначим замер и подготовим предварительный расчёт в течение 24 часов.</p><a href="/#contacts" className="blog-button">Оставить заявку на замер <ArrowRight size={18} /></a></div></section>
      </main>
      <BlogFooter />
    </div>
  );
}
