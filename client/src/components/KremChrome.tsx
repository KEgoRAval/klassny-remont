import { useEffect, useState } from "react";
import { Menu, Minus, Phone, Plus, X } from "lucide-react";

/** Lucide stroke width of the 1a design. */
export const ICON_STROKE = 2.75;

/** The green full stop from the 1a logo, closing headings. */
export function Dot({ tone = "sage" }: { tone?: "sage" | "accent" }) {
  return <span className={`k-dot k-dot-${tone}`} aria-hidden="true"></span>;
}

export function SectionLabel({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "sage" | "light" }) {
  return <div className={`k-label k-label-${tone}`}><span></span>{children}</div>;
}

/** Wordmark 1a — «Krem • moscow» with the «Классный ремонт» caption, see client/public/krem-logo.svg. */
export function KremLogo({ size = "header" }: { size?: "header" | "footer" }) {
  return (
    <span className={`k-logo k-logo-${size}`}>
      <span className="k-logo-mark"><span className="k-logo-krem">Krem</span><span className="k-logo-dot"></span><span className="k-logo-city">moscow</span></span>
      <span className="k-logo-caption">Классный ремонт</span>
    </span>
  );
}

type Page = "home" | "blog" | "legal" | "service";

/** Section links of the home page; elsewhere they lead back to it. */
function navLinks(page: Page) {
  const base = page === "home" ? "" : "/";
  return [
    { href: `${base}#projects`, label: "Проекты" },
    { href: `${base}#process`, label: "Процесс" },
    { href: page === "home" ? "#prices" : "/ceny", label: "Цены" },
    { href: "/blog", label: "Блог", current: page === "blog" },
    { href: `${base}#about`, label: "О компании" },
    { href: `${base}#contacts`, label: "Контакты" },
  ];
}

export function SiteHeader({ page }: { page: Page }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const links = navLinks(page);
  const contacts = page === "home" ? "#contacts" : "/#contacts";
  const close = () => setMenuOpen(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="k-header">
      <div className="k-header-bar">
        <a className="k-header-brand" href={page === "home" ? "#top" : "/"} aria-label="Классный ремонт — главная"><KremLogo /></a>
        <nav className="k-nav" aria-label="Главное меню">
          {links.map(link => <a key={link.href} href={link.href} aria-current={link.current ? "page" : undefined}>{link.label}</a>)}
        </nav>
        <a className="k-header-phone" href="tel:+79779480672"><Phone size={16} strokeWidth={ICON_STROKE} />8 (977) 948‑06‑72</a>
        <a className="btn btn-primary k-header-cta" href={contacts}>Получить смету</a>
        <button className="btn btn-secondary btn-icon k-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"} aria-expanded={menuOpen} aria-controls="mobile-menu">{menuOpen ? <X size={22} strokeWidth={ICON_STROKE} /> : <Menu size={22} strokeWidth={ICON_STROKE} />}</button>
      </div>
      {menuOpen && (
        <nav className="k-mobile-menu" id="mobile-menu" aria-label="Мобильное меню">
          {links.map(link => <a key={link.href} href={link.href} onClick={close} aria-current={link.current ? "page" : undefined}>{link.label}</a>)}
          <div className="k-mobile-menu-actions">
            <a className="btn btn-primary k-btn-md" href={contacts} onClick={close}>Получить смету по проекту</a>
            <a className="btn btn-secondary k-btn-md" href="tel:+79779480672">8 (977) 948‑06‑72</a>
          </div>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter({ page }: { page: Page }) {
  const base = page === "home" ? "" : "/";
  return (
    <footer className="k-footer k-container">
      <div className="k-footer-top">
        <a href={page === "home" ? "#top" : "/"} aria-label={page === "home" ? "Классный ремонт — наверх" : "Классный ремонт — главная"}><KremLogo size="footer" /></a>
        <nav className="k-footer-links" aria-label="Навигация в подвале"><a href="/elitnyy-remont-kvartir">Элитный ремонт</a><a href="/remont-po-dizayn-proektu">Ремонт по дизайн-проекту</a><a href="/dizayn-proekt">Дизайн-проект</a><a href={`${base}#projects`}>Портфолио</a><a href={`${base}#process`}>Процесс</a><a href="/ceny">Цены</a><a href="/blog">Блог</a><a href={`${base}#contacts`}>Контакты</a></nav>
      </div>
      <div className="k-legal" aria-label="Реквизиты индивидуального предпринимателя"><span>ИП Бережной Егор Юрьевич</span><span><small>ОГРНИП</small><b>321527500117786</b></span><span><small>ИНН</small><b>773166101203</b></span><span><small>ОКПО</small><b>2011448980</b></span></div>
      <div className="k-footer-bottom"><span>© 2026 ИП Бережной Егор Юрьевич</span><a href="/privacy-policy">Политика обработки персональных данных</a><a href="/personal-data-consent">Согласие на обработку данных</a><span>Москва · ремонт квартир под ключ</span><a href="#top">Наверх ↑</a></div>
    </footer>
  );
}

/** The round +/− marker of a FAQ <details> item; CSS shows the one that matches its state. */
export function FaqIcon() {
  return <span className="k-faq-icon" aria-hidden="true"><Plus className="k-faq-plus" size={18} strokeWidth={ICON_STROKE} /><Minus className="k-faq-minus" size={18} strokeWidth={ICON_STROKE} /></span>;
}
