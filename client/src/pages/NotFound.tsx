import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0b0e0d] p-4 text-zinc-100 font-sans">
      <Card className="w-full max-w-md border border-[#27312d] bg-[#121715] shadow-2xl rounded-2xl">
        <CardContent className="pt-8 pb-8 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-red-950/40 border border-red-800/60 flex items-center justify-center mb-6">
            <AlertCircle className="h-8 w-8 text-red-500 animate-pulse" />
          </div>

          <h1 className="text-5xl font-mono font-black text-white tracking-tight mb-2">404</h1>

          <h2 className="text-lg font-mono font-bold text-zinc-200 mb-2">
            Flight Path Not Found
          </h2>

          <p className="text-zinc-400 text-xs mb-8 max-w-xs leading-relaxed">
            The page or sector you navigated to does not exist or has flown away into deep airspace.
          </p>

          <Button
            onClick={() => setLocation("/")}
            className="bg-lime-400 hover:bg-lime-300 text-black font-mono font-bold text-xs px-6 h-11 rounded-xl shadow-lg shadow-lime-950/40 flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            Return to Aviator Flight Deck
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
