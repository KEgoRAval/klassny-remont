import { ArrowRight } from "lucide-react";
import { Dot, ICON_STROKE, SectionLabel, SiteFooter, SiteHeader } from "@/components/KremChrome";

export default function NotFound() {
  return (
    <div className="krem-site k-not-found" id="top">
      <SiteHeader page="legal" />
      <main className="k-container k-not-found-main">
        <span className="k-not-found-code" aria-hidden="true">404</span>
        <div className="k-stack k-stack-lg">
          <SectionLabel>Страница не найдена</SectionLabel>
          <h1>Такой страницы <span className="k-accent">нет</span><Dot /></h1>
          <p className="k-body-lg">Возможно, ссылка устарела или в адресе опечатка. Начните с главной или загляните в блог о ремонте.</p>
          <div className="k-actions">
            <a href="/" className="btn btn-primary k-btn-lg">На главную <ArrowRight size={18} strokeWidth={ICON_STROKE} /></a>
            <a href="/blog" className="btn btn-secondary k-btn-lg">Блог о ремонте</a>
          </div>
        </div>
      </main>
      <SiteFooter page="legal" />
    </div>
  );
}
