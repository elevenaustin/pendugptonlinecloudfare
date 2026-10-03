import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Laptop,
  Loader2,
  Search,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { siteConfig } from "@/config/site";
import { registrationSchema, submitRegistration } from "@/lib/leads.functions";
import { track } from "@/lib/analytics";
import { BrandLogo } from "@/components/common/BrandLogo";

interface Country {
  name: string;
  code: string;
  flag: string;
  sampleLength?: number;
}

const countries: Country[] = [
  { name: "India", code: "+91", flag: "🇮🇳", sampleLength: 10 },
  { name: "United States", code: "+1", flag: "🇺🇸", sampleLength: 10 },
  { name: "United Kingdom", code: "+44", flag: "🇬🇧", sampleLength: 10 },
  { name: "United Arab Emirates", code: "+971", flag: "🇦🇪", sampleLength: 9 },
  { name: "Canada", code: "+1", flag: "🇨🇦", sampleLength: 10 },
  { name: "Australia", code: "+61", flag: "🇦🇺", sampleLength: 9 },
  { name: "Singapore", code: "+65", flag: "🇸🇬", sampleLength: 8 },
  { name: "Saudi Arabia", code: "+966", flag: "🇸🇦", sampleLength: 9 },
  { name: "Germany", code: "+49", flag: "🇩🇪", sampleLength: 10 },
  { name: "France", code: "+33", flag: "🇫🇷", sampleLength: 9 },
  { name: "Pakistan", code: "+92", flag: "🇵🇰", sampleLength: 10 },
  { name: "Bangladesh", code: "+880", flag: "🇧🇩", sampleLength: 10 },
  { name: "Nepal", code: "+977", flag: "🇳🇵", sampleLength: 10 },
  { name: "Sri Lanka", code: "+94", flag: "🇱🇰", sampleLength: 9 },
  { name: "Qatar", code: "+974", flag: "🇶🇦", sampleLength: 8 },
  { name: "Kuwait", code: "+965", flag: "🇰🇼", sampleLength: 8 },
  { name: "Oman", code: "+968", flag: "🇴🇲", sampleLength: 8 },
  { name: "Bahrain", code: "+973", flag: "🇧🇭", sampleLength: 8 },
  { name: "Malaysia", code: "+60", flag: "🇲🇾", sampleLength: 9 },
  { name: "New Zealand", code: "+64", flag: "🇳🇿", sampleLength: 9 },
  { name: "South Africa", code: "+27", flag: "🇿🇦", sampleLength: 9 },
  { name: "Indonesia", code: "+62", flag: "🇮🇩", sampleLength: 10 },
  { name: "Philippines", code: "+63", flag: "🇵🇭", sampleLength: 10 },
  { name: "Ireland", code: "+353", flag: "🇮🇪", sampleLength: 9 },
  { name: "Netherlands", code: "+31", flag: "🇳🇱", sampleLength: 9 },
  { name: "Italy", code: "+39", flag: "🇮🇹", sampleLength: 10 },
  { name: "Spain", code: "+34", flag: "🇪🇸", sampleLength: 9 },
  { name: "Brazil", code: "+55", flag: "🇧🇷", sampleLength: 11 },
  { name: "Nigeria", code: "+234", flag: "🇳🇬", sampleLength: 10 },
  { name: "Kenya", code: "+254", flag: "🇰🇪", sampleLength: 9 },
];

export function RegistrationScreen() {
  const navigate = useNavigate();
  const registerFn = useServerFn(submitRegistration);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]);
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  const [whatsapp, setWhatsapp] = useState("");
  const [gender, setGender] = useState<string>("");
  const [device, setDevice] = useState<string>("");

  const [errors, setErrors] = useState<{ whatsapp?: string }>({});
  const [loading, setLoading] = useState(false);

  // If already registered from a previous session or same browser, skip initial questions and proceed straight to training!
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(siteConfig.video.registrationKey) || "null");
      if (saved && saved.registered) {
        navigate({ to: "/training" });
      }
    } catch {
      /* ignore */
    }
  }, [navigate]);

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return countries;
    const q = countrySearch.toLowerCase().trim();
    return countries.filter((c) => c.name.toLowerCase().includes(q) || c.code.includes(q));
  }, [countrySearch]);

  const handleStep1Submit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const digits = whatsapp.replace(/\D/g, "");
    if (digits.length < 7) {
      setErrors({ whatsapp: "Please enter a valid mobile number" });
      return;
    }
    setErrors({});
    setStep(2);
    track("funnel_step_1_completed", { country: selectedCountry.code });
  };

  const handleGenderSelect = (selectedGender: string) => {
    setGender(selectedGender);
    // Smooth auto-advance to step 3 on tap
    setTimeout(() => {
      setStep(3);
      track("funnel_step_2_completed", { gender: selectedGender });
    }, 180);
  };

  const handleDeviceSelect = async (selectedDevice: string) => {
    setDevice(selectedDevice);
    setLoading(true);

    const parsed = registrationSchema.safeParse({
      countryCode: selectedCountry.code,
      whatsapp,
      gender: gender || undefined,
      device: selectedDevice,
      marketingConsent: true,
    });

    try {
      const res = await registerFn({
        data: parsed.success
          ? parsed.data
          : {
              countryCode: selectedCountry.code,
              whatsapp: whatsapp.replace(/\D/g, "") || "9999999999",
              gender,
              device: selectedDevice,
              marketingConsent: true,
            },
      });

      try {
        localStorage.setItem(
          siteConfig.video.registrationKey,
          JSON.stringify({
            registered: true,
            registeredAt: res?.registeredAt || new Date().toISOString(),
            countryCode: selectedCountry.code,
            suffix: whatsapp.slice(-4),
          }),
        );
      } catch {
        /* ignore */
      }

      track("funnel_registration_success");
      navigate({ to: "/training" });
    } catch (err) {
      console.error("Registration error:", err);
      try {
        localStorage.setItem(
          siteConfig.video.registrationKey,
          JSON.stringify({ registered: true, registeredAt: new Date().toISOString() }),
        );
      } catch {
        /* ignore */
      }
      navigate({ to: "/training" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between text-foreground selection:bg-[#00F076] selection:text-black">
      <div className="w-full flex-1 flex flex-col justify-between px-4 py-6 sm:py-10">
        {/* Top Header Logo */}
        <header className="relative z-10 mx-auto w-full max-w-lg text-center pt-2 pb-4">
          <BrandLogo size="lg" className="mx-auto" />
        </header>

      {/* Main Reference Pop Card with Lightweight Glass Backdrop */}
      <main className="relative z-10 mx-auto my-auto w-full max-w-lg pt-4 pb-6">
        <div className="relative overflow-hidden rounded-[28px] sm:rounded-[32px] glass-card p-6 sm:p-9 transition-all duration-300">
          {/* Header with Exact Connected Number Steps and STEP X OF 3 */}
          <div className="flex items-center justify-between mb-7">
            {/* Connected Number Nodes */}
            <div className="flex items-center gap-2">
              {/* Step 1 Node */}
              <div
                className={`grid h-8 w-8 place-items-center rounded-full text-xs font-display font-extrabold transition-all duration-300 ${
                  step >= 1
                    ? "bg-[#00F076] text-black shadow-[0_0_15px_rgba(0,240,118,0.7)]"
                    : "bg-[#0a1810] text-white/40 border border-white/10"
                }`}
              >
                1
              </div>

              {/* Line 1-2 */}
              <div
                className={`h-[2.5px] w-6 sm:w-8 rounded-full transition-all duration-300 ${
                  step >= 2 ? "bg-[#00F076] shadow-[0_0_8px_rgba(0,240,118,0.6)]" : "bg-[#112418]"
                }`}
              />

              {/* Step 2 Node */}
              <div
                className={`grid h-8 w-8 place-items-center rounded-full text-xs font-display font-extrabold transition-all duration-300 ${
                  step >= 2
                    ? "bg-[#00F076] text-black shadow-[0_0_15px_rgba(0,240,118,0.7)]"
                    : "bg-[#0a1810] text-white/40 border border-white/10"
                }`}
              >
                2
              </div>

              {/* Line 2-3 */}
              <div
                className={`h-[2.5px] w-6 sm:w-8 rounded-full transition-all duration-300 ${
                  step >= 3 ? "bg-[#00F076] shadow-[0_0_8px_rgba(0,240,118,0.6)]" : "bg-[#112418]"
                }`}
              />

              {/* Step 3 Node */}
              <div
                className={`grid h-8 w-8 place-items-center rounded-full text-xs font-display font-extrabold transition-all duration-300 ${
                  step >= 3
                    ? "bg-[#00F076] text-black shadow-[0_0_15px_rgba(0,240,118,0.7)]"
                    : "bg-[#0a1810] text-white/40 border border-white/10"
                }`}
              >
                3
              </div>
            </div>

            {/* Step Counter Label */}
            <div className="flex items-center gap-1.5 text-xs font-display font-bold uppercase tracking-wider text-[#00F076]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>STEP {step} OF 3</span>
            </div>
          </div>

          {/* =========================================================================
              SCREEN 1: ENTER YOUR NUMBER FOR FREE TRAINING VIDEO
             ========================================================================= */}
          {step === 1 && (
            <div className="animate-reveal">
              {/* Question Title & Clean Description */}
              <div>
                <h1 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight leading-snug">
                  Enter your number for Free Training video
                </h1>
                <p className="mt-2 text-sm sm:text-base font-normal text-[#A1B2A8]">
                  Enter your mobile number to get instant access to the masterclass:
                </p>
              </div>

              <form onSubmit={handleStep1Submit} className="mt-7 space-y-4" noValidate>
                <div>
                  <div className="relative flex items-center rounded-full border border-white/15 bg-[#030906] p-1.5 transition-all focus-within:border-[#00F076] focus-within:ring-2 focus-within:ring-[#00F076]/30">
                    {/* Country Code Pill Button */}
                    <button
                      type="button"
                      onClick={() => setCountryModalOpen(true)}
                      className="flex items-center gap-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 pl-3 pr-2.5 py-2.5 text-xs font-bold text-white shrink-0 transition-colors select-none"
                    >
                      <span className="text-base leading-none">{selectedCountry.flag}</span>
                      <span>{selectedCountry.code}</span>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>

                    <input
                      id="whatsapp"
                      type="tel"
                      inputMode="tel"
                      autoFocus
                      placeholder="Enter mobile number"
                      value={whatsapp}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/[^\d\s-]/g, "");
                        setWhatsapp(cleaned);
                        if (errors.whatsapp) setErrors({});
                      }}
                      className="w-full bg-transparent px-3.5 py-2 text-sm sm:text-base font-medium text-white placeholder:text-muted-foreground/50 outline-none"
                    />
                  </div>

                  {errors.whatsapp && (
                    <p className="mt-2 pl-3 text-xs text-rose-400 font-medium">{errors.whatsapp}</p>
                  )}
                </div>

                {/* Big Rich Electric Emerald CTA Button */}
                <button
                  type="submit"
                  className="group mt-4 w-full flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#00F076] to-[#00D668] py-3.5 sm:py-4 text-sm font-display font-extrabold italic uppercase tracking-wider text-black shadow-[0_0_30px_rgba(0,240,118,0.45)] transition-all hover:opacity-95 hover:shadow-[0_0_40px_rgba(0,240,118,0.65)] active:scale-[0.99] cursor-pointer"
                >
                  <span>CONTINUE</span>
                  <ArrowRight className="h-4 w-4 stroke-[2.5] transition-transform group-hover:translate-x-1" />
                </button>
              </form>
            </div>
          )}

          {/* =========================================================================
              SCREEN 2: ARE YOU MALE OR FEMALE? (MATCHING EXACT REFERENCE IMAGE 1)
             ========================================================================= */}
          {step === 2 && (
            <div className="animate-reveal">
              {/* Question Title & Clean Description */}
              <div>
                <h2 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight leading-snug">
                  Are you male or female?
                </h2>
                <p className="mt-2 text-sm sm:text-base font-normal text-[#A1B2A8]">
                  Please select your gender to personalize your training:
                </p>
              </div>

              {/* 2-Column Grid of Big Attractive Cards */}
              <div className="mt-7 grid grid-cols-2 gap-4 sm:gap-5">
                {/* Male Card */}
                <button
                  type="button"
                  onClick={() => handleGenderSelect("Male")}
                  className={`group relative flex flex-col items-center justify-center rounded-2xl sm:rounded-3xl py-8 sm:py-10 transition-all duration-200 cursor-pointer ${
                    gender === "Male"
                      ? "glass-option-active scale-[1.02]"
                      : "glass-option hover:border-[#00F076]/40 active:scale-[0.99]"
                  }`}
                >
                  {/* Circular Icon with Emerald Aura */}
                  <div className="grid h-16 w-16 sm:h-20 sm:w-20 place-items-center rounded-full bg-[#072416] border border-[#00F076]/30 text-[#00F076] shadow-[0_0_20px_rgba(0,240,118,0.25)] transition-transform group-hover:scale-105">
                    <User className="h-8 w-8 sm:h-10 sm:w-10 stroke-[2.2]" />
                  </div>
                  {/* Clean Bold Title */}
                  <span className="mt-4 font-display font-bold text-base sm:text-lg text-white">
                    Male
                  </span>
                </button>

                {/* Female Card */}
                <button
                  type="button"
                  onClick={() => handleGenderSelect("Female")}
                  className={`group relative flex flex-col items-center justify-center rounded-2xl sm:rounded-3xl py-8 sm:py-10 transition-all duration-200 cursor-pointer ${
                    gender === "Female"
                      ? "glass-option-active scale-[1.02]"
                      : "glass-option hover:border-[#00F076]/40 active:scale-[0.99]"
                  }`}
                >
                  {/* Circular Icon with Emerald Aura */}
                  <div className="grid h-16 w-16 sm:h-20 sm:w-20 place-items-center rounded-full bg-[#072416] border border-[#00F076]/30 text-[#00F076] shadow-[0_0_20px_rgba(0,240,118,0.25)] transition-transform group-hover:scale-105">
                    <User className="h-8 w-8 sm:h-10 sm:w-10 stroke-[2.2]" />
                  </div>
                  {/* Clean Bold Title */}
                  <span className="mt-4 font-display font-bold text-base sm:text-lg text-white">
                    Female
                  </span>
                </button>
              </div>

              {/* Back Button */}
              <div className="mt-6 flex justify-start">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              SCREEN 3: DO YOU HAVE A LAPTOP OR PC FOR WORK? (MATCHING EXACT REFERENCE IMAGE 2)
             ========================================================================= */}
          {step === 3 && (
            <div className="animate-reveal">
              {/* Question Title & Clean Description */}
              <div>
                <h2 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight leading-snug">
                  Do you have a laptop or PC for work?
                </h2>
                <p className="mt-2 text-sm sm:text-base font-normal text-[#A1B2A8]">
                  Select your current computer availability for building websites:
                </p>
              </div>

              {/* Vertical Stack of Options matching screenshot 2 */}
              <div className="mt-7 space-y-3">
                {/* Option 1: Yes, I have a Laptop/PC */}
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleDeviceSelect("Yes, I have a Laptop/PC")}
                  className={`w-full flex items-center justify-between rounded-2xl sm:rounded-full p-3.5 sm:p-4 text-left transition-all duration-200 cursor-pointer ${
                    device === "Yes, I have a Laptop/PC"
                      ? "glass-option-active scale-[1.01]"
                      : "glass-option hover:border-[#00F076]/40 active:scale-[0.99]"
                  } disabled:opacity-70`}
                >
                  <div className="flex items-center gap-3.5">
                    {/* Green Badge */}
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#072416] border border-[#00F076]/30 text-[#00F076]">
                      <Laptop className="h-5 w-5 stroke-[2.2]" />
                    </div>
                    <span className="font-display font-bold text-sm sm:text-base text-white">
                      Yes, I have a Laptop/PC
                    </span>
                  </div>
                  {device === "Yes, I have a Laptop/PC" && (
                    <CheckCircle2 className="h-5 w-5 text-[#00F076] shrink-0" />
                  )}
                </button>

                {/* Option 2: No, I don't have one */}
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleDeviceSelect("No, I don't have one")}
                  className={`w-full flex items-center justify-between rounded-2xl sm:rounded-full p-3.5 sm:p-4 text-left transition-all duration-200 cursor-pointer ${
                    device === "No, I don't have one"
                      ? "glass-option-active scale-[1.01]"
                      : "glass-option hover:border-[#00F076]/40 active:scale-[0.99]"
                  } disabled:opacity-70`}
                >
                  <div className="flex items-center gap-3.5">
                    {/* Subtle Dark Badge */}
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#101c15] border border-white/10 text-white/70">
                      <Laptop className="h-5 w-5 stroke-[2]" />
                    </div>
                    <span className="font-display font-bold text-sm sm:text-base text-white">
                      No, I don't have one
                    </span>
                  </div>
                  {device === "No, I don't have one" && (
                    <CheckCircle2 className="h-5 w-5 text-[#00F076] shrink-0" />
                  )}
                </button>

                {/* Option 3: Can manage / arrange later */}
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleDeviceSelect("Can manage / arrange later")}
                  className={`w-full flex items-center justify-between rounded-2xl sm:rounded-full p-3.5 sm:p-4 text-left transition-all duration-200 cursor-pointer ${
                    device === "Can manage / arrange later"
                      ? "glass-option-active scale-[1.01]"
                      : "glass-option hover:border-[#00F076]/40 active:scale-[0.99]"
                  } disabled:opacity-70`}
                >
                  <div className="flex items-center gap-3.5">
                    {/* Amber Badge */}
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#261f0a] border border-amber-500/30 text-amber-400">
                      <Laptop className="h-5 w-5 stroke-[2.2]" />
                    </div>
                    <span className="font-display font-bold text-sm sm:text-base text-white">
                      Can manage / arrange later
                    </span>
                  </div>
                  {device === "Can manage / arrange later" && (
                    <CheckCircle2 className="h-5 w-5 text-[#00F076] shrink-0" />
                  )}
                </button>
              </div>

              {/* Back button & Loader */}
              <div className="mt-6 flex items-center justify-between">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
                </button>

                {loading && (
                  <div className="inline-flex items-center gap-2 text-xs text-[#00F076]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Launching training...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      </div>

      {/* Country Code Selection Modal */}
      {countryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-reveal">
          <div className="w-full max-w-sm rounded-[24px] glass-card p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-display font-bold text-base text-white">Select Country Code</h3>
              <button
                onClick={() => setCountryModalOpen(false)}
                className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-muted-foreground hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search Country Input */}
            <div className="mt-3 relative flex items-center rounded-full border border-white/15 bg-[#030906] px-3 py-2 text-xs focus-within:border-[#00F076]">
              <Search className="h-3.5 w-3.5 text-muted-foreground mr-2" />
              <input
                type="text"
                autoFocus
                placeholder="Search country or code..."
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                className="w-full bg-transparent text-white placeholder:text-muted-foreground/60 outline-none"
              />
            </div>

            {/* Country List */}
            <div className="mt-3 max-h-64 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
              {filteredCountries.map((c) => (
                <button
                  key={`${c.name}-${c.code}`}
                  onClick={() => {
                    setSelectedCountry(c);
                    setCountryModalOpen(false);
                    setCountrySearch("");
                  }}
                  className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-xs transition-colors cursor-pointer ${
                    selectedCountry.name === c.name
                      ? "bg-[#00F076]/20 text-white font-bold border border-[#00F076]/40"
                      : "text-muted-foreground hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{c.flag}</span>
                    <span>{c.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[#00F076]">
                    <span>{c.code}</span>
                    {selectedCountry.name === c.name && <Check className="h-3.5 w-3.5" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Minimal Footer */}
      <footer className="relative z-10 mx-auto text-center text-xs text-white/40 py-4">
        <p>© {new Date().getFullYear()} PenduGPT. All rights reserved.</p>
      </footer>
    </div>
  );
}

