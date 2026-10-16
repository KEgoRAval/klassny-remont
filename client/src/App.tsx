import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { Head } from "./components/Head";
import { ThemeProvider } from "./contexts/ThemeContext";
import { BlogArticle, BlogIndex } from "./pages/Blog";
import { PersonalDataConsentPage, PrivacyPolicy } from "./pages/Legal";
import { CookieConsent } from "./components/CookieConsent";
import { MessengerQuickActions } from "./components/MessengerQuickActions";
import Home from "./pages/Home";
import MaxQuiz from "./pages/MaxQuiz";
import { ServicePageView } from "./pages/ServicePage";
import { servicePages } from "./content/services";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/max"} component={MaxQuiz} />
      {servicePages.map(page => <Route key={page.path} path={page.path}>{() => <ServicePageView page={page} />}</Route>)}
      <Route path={"/blog"} component={BlogIndex} />
      <Route path={"/blog/:slug"} component={BlogArticle} />
      <Route path={"/privacy-policy"} component={PrivacyPolicy} />
      <Route path={"/personal-data-consent"} component={PersonalDataConsentPage} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

/** The MAX mini-app page has one action; the floating Telegram/WhatsApp buttons would compete with it. */
function QuickActions() {
  const [location] = useLocation();
  return location.replace(/\/+$/, "") === "/max" ? null : <MessengerQuickActions />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Head />
          <Toaster />
          <Router />
          <CookieConsent />
          <QuickActions />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
