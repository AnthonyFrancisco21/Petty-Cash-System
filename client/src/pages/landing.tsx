import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Wallet,
  FileText,
  CheckCircle,
  RefreshCw,
  Shield,
  BarChart3,
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Voucher Management",
    description:
      "Create and track petty cash vouchers with complete audit trail",
  },
  {
    icon: CheckCircle,
    title: "Approval Workflow",
    description:
      "Online request submission and approval for transparent operations",
  },
  {
    icon: RefreshCw,
    title: "Replenishment Reports",
    description: "Generate comprehensive reports with VAT breakdown and totals",
  },
  {
    icon: Shield,
    title: "Role-Based Access",
    description: "Secure access control for cash managers and requesters",
  },
  {
    icon: BarChart3,
    title: "Chart of Accounts",
    description:
      "Track disbursements by account code for proper financial reporting",
  },
  {
    icon: Wallet,
    title: "Fund Tracking",
    description:
      "Real-time visibility into petty cash balance and depletion status",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold">P CashManager</span>
          </div>
          <a href="/auth">
            <Button data-testid="button-login">Log In</Button>
          </a>
        </div>
      </header>

      <main>
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
              Petty Cash Management
              <br />
              <span className="text-muted-foreground">Made Simple</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A comprehensive solution for managing your company's petty cash
              imprest fund. Track disbursements, manage approvals, and generate
              replenishment reports with ease.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <a href="/auth">
                <Button size="lg" data-testid="button-get-started">
                  Get Started
                </Button>
              </a>
              <Button
                variant="outline"
                size="lg"
                data-testid="button-learn-more"
              >
                Learn More
              </Button>
            </div>
          </div>
        </section>

        <section className="py-16 px-6 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-semibold mb-3">
                Everything You Need
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Streamline your petty cash operations with powerful features
                designed for efficiency
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature) => (
                <Card key={feature.title} className="border-card-border">
                  <CardContent className="p-6 space-y-3">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-medium text-lg">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-6">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl font-semibold">
              Ready to streamline your petty cash?
            </h2>
            <p className="text-muted-foreground">
              Sign in to start managing your petty cash fund today
            </p>
            <a href="/auth">
              <Button size="lg" data-testid="button-sign-in-cta">
                Sign In Now
              </Button>
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="h-4 w-4" />
            <span>P CashManager</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Petty Cash Management System
          </p>
        </div>
      </footer>
    </div>
  );
}
