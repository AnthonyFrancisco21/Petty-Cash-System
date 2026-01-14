import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Wallet,
  FileText,
  CheckCircle,
  RefreshCw,
  Shield,
  BarChart3,
  ArrowRight,
  ChevronDown,
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Digital Voucher Management",
    description:
      "Transform your physical receipts into organized digital records. Create, track, and manage petty cash vouchers with high-resolution file attachments and full audit logs.",
  },
  {
    icon: CheckCircle,
    title: "Automated Approval Loops",
    description:
      "Replace manual signatures with a streamlined digital workflow. Notify approvers instantly and track the status of every request in real-time.",
  },
  {
    icon: RefreshCw,
    title: "Instant Replenishment",
    description:
      "Generate comprehensive replenishment reports at the click of a button. Includes automated VAT calculations and account code summaries for accounting.",
  },
  {
    icon: Shield,
    title: "Secure Role Access",
    description:
      "Assign specific roles for Preparers, Approvers, and Administrators. Ensure sensitive financial data is only accessible to authorized personnel.",
  },
  {
    icon: BarChart3,
    title: "Smart COA Tagging",
    description:
      "Maintain a clean General Ledger. Tag disbursements directly to your Chart of Accounts to ensure every expense is categorized correctly from the start.",
  },
  {
    icon: Wallet,
    title: "Fund Visibility",
    description:
      "Real-time monitoring of your total imprest fund. Visualize spending trends, current balances, and receive alerts when funds are running low.",
  },
];

export default function Landing() {
  const featuresRef = useRef<HTMLDivElement>(null);

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="h-screen overflow-y-auto bg-background">
      {/* FIXED NAVBAR */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              P CashManager
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/auth"
              className="hidden sm:block text-sm font-medium hover:text-primary transition-colors"
            >
              Sign In
            </a>
            <a href="/auth">
              <Button data-testid="button-login" size="sm">
                Get Started
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT WITH PADDING FOR FIXED HEADER */}
      <main className="pt-[73px]">
        {/* Hero Section */}
        <section className="py-24 px-6">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium bg-muted/50 text-muted-foreground mb-4">
              <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Trusted by Finance Teams
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground">
              Master Your Petty Cash
              <br />
              <span className="text-primary">Without the Paperwork.</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              The all-in-one platform for managing company disbursements. Track
              expenses, automate approvals, and generate replenishment reports
              with absolute precision.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <a href="/auth">
                <Button
                  size="lg"
                  className="px-8 h-12 text-md"
                  data-testid="button-get-started"
                >
                  Launch Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
              <Button
                variant="outline"
                size="lg"
                className="h-12 text-md"
                onClick={scrollToFeatures}
                data-testid="button-learn-more"
              >
                Learn More <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section ref={featuresRef} className="py-24 px-6 bg-muted/30 border-y">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold">
                Everything You Need for Compliance
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                Stop relying on spreadsheets. P CashManager brings
                enterprise-grade financial controls to your daily petty cash
                operations.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature) => (
                <Card
                  key={feature.title}
                  className="border-card-border bg-card/50 hover:bg-card transition-all duration-300 hover:shadow-lg"
                >
                  <CardContent className="p-8 space-y-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-bold text-xl">{feature.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="py-32 px-6">
          <div className="max-w-3xl mx-auto text-center space-y-8 bg-primary/5 rounded-3xl p-12 border border-primary/10">
            <h2 className="text-4xl font-bold">
              Ready to automate your petty cash?
            </h2>
            <p className="text-lg text-muted-foreground">
              Sign in now to begin organizing your fund, tracking disbursements,
              and generating audit-ready reports in seconds.
            </p>
            <div className="pt-4">
              <a href="/auth">
                <Button
                  size="lg"
                  className="h-14 px-10 text-lg shadow-xl shadow-primary/20"
                  data-testid="button-sign-in-cta"
                >
                  Get Started Today
                </Button>
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-12 px-6 bg-card">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="flex items-center gap-2 text-lg font-bold">
              <div className="bg-primary p-1.5 rounded-md">
                <Wallet className="h-5 w-5 text-primary-foreground" />
              </div>
              <span>P CashManager</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs text-center md:text-left">
              The gold standard for modern, secure, and transparent petty cash
              management.
            </p>
          </div>

          <div className="flex flex-col items-center md:items-end gap-2 text-sm text-muted-foreground">
            <div className="flex gap-6 mb-2">
              <span className="hover:text-primary cursor-pointer">
                Privacy Policy
              </span>
              <span className="hover:text-primary cursor-pointer">
                Terms of Service
              </span>
            </div>
            <p>© 2026 P CashManager. Built for Financial Excellence.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
