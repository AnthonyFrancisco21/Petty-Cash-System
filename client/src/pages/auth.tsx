import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wallet, AlertCircle } from "lucide-react";

type AuthMode = "login" | "register";

export default function AuthPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (mode === "register") {
        // Register new user
        const response = await fetch("/api/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            username,
            password,
            firstName,
            lastName,
          }),
        });

        if (response.status === 201 || response.status === 200) {
          // Registration successful: update auth cache and redirect to app root
          const user = await response.json();
          queryClient.setQueryData(["/api/auth/user"], user);
          navigate("/");
        } else {
          const data = await response.json();
          setError(data.message || "Registration failed");
        }
      } else {
        // Login
        const response = await fetch("/api/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            username,
            password,
          }),
        });

        if (response.status === 200) {
          // Login successful: update auth cache and redirect to app root
          const user = await response.json();
          queryClient.setQueryData(["/api/auth/user"], user);
          navigate("/");
        } else {
          const data = await response.json();
          setError(data.message || "Login failed");
        }
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(
        err.response?.data?.message ||
          (mode === "login"
            ? "Invalid username or password"
            : "Registration failed")
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold">P CashManager</span>
          </div>
        </div>

        {/* Auth Card */}
        <Card>
          <CardHeader>
            <CardTitle>
              {mode === "login" ? "Sign In" : "Create Account"}
            </CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Enter your credentials to access the system"
                : "Create a new account to get started"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Username</label>
                <Input
                  type="text"
                  placeholder="john_doe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={isLoading}
                  className="mt-1"
                />
              </div>

              {mode === "register" && (
                <>
                  <div>
                    <label className="text-sm font-medium">First Name</label>
                    <Input
                      type="text"
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={isLoading}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Last Name</label>
                    <Input
                      type="text"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={isLoading}
                      className="mt-1"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-sm font-medium">Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="mt-1"
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading
                  ? "Loading..."
                  : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm">
              {mode === "login" ? (
                <>
                  Don't have an account?{" "}
                  <button
                    onClick={() => {
                      setMode("register");
                      setError("");
                    }}
                    className="text-primary hover:underline font-medium"
                  >
                    Register
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    onClick={() => {
                      setMode("login");
                      setError("");
                    }}
                    className="text-primary hover:underline font-medium"
                  >
                    Sign In
                  </button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Secure petty cash management system
        </p>
      </div>
    </div>
  );
}
